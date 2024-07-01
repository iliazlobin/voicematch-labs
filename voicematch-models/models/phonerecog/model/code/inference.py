import os
import secrets
import shutil

import torch
from datasets import Audio, Dataset
from pydub import AudioSegment
from transformers import Wav2Vec2ForCTC, Wav2Vec2Processor

# logger = logging.getLogger(__name__)
# logger.setLevel(logging.DEBUG)
# logger.addHandler(logging.StreamHandler(sys.stdout))

# device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

SAMPLE_RATE = os.getenv("SAMPLE_RATE", 16000)


def model_fn(model_dir):
    print(f"loading model from {model_dir}")
    model = Wav2Vec2ForCTC.from_pretrained(model_dir)
    processor = Wav2Vec2Processor.from_pretrained(model_dir)

    return model, processor


def input_fn(input_data, content_type):
    suffix = secrets.token_hex(nbytes=24)
    ogg_file = f"/tmp/vm-{suffix}.ogg"

    print(f"saving file for processing: {ogg_file}, with {len(input_data)} bytes, and {content_type} content type")
    with open(ogg_file, "wb") as f:
        f.write(input_data)
        f.close()

    audio = AudioSegment.from_file(ogg_file)
    audio = audio.set_frame_rate(SAMPLE_RATE).set_channels(1)

    wav_file = f"/tmp/vm-{suffix}.wav"
    audio.export(wav_file, format="wav")
    print(f"file to be procesesed: {wav_file}, ${SAMPLE_RATE} Hz")

    speech_ds = Dataset.from_dict({"audio": [wav_file]}).cast_column("audio", Audio(sampling_rate=SAMPLE_RATE))

    return speech_ds[0]["audio"]


def predict_fn(audio_ds, params):
    model, processor = params

    speech_input_values = processor(audio_ds["array"], return_tensors="pt", padding="longest").input_values

    print(f"predicting phonemes from {audio_ds['path']}")
    output = model(speech_input_values)
    phonemes_logits = output.logits

    predicted_ids = torch.argmax(phonemes_logits, dim=-1)
    transcription = processor.batch_decode(predicted_ids, output_char_offsets=True)
    print(f"phonemes predicted: {transcription.text}")

    speech_time_offset = model.config.inputs_to_logits_ratio / SAMPLE_RATE
    # print("speech_time_offset: ${speech_time_offset}")

    phonemes = [
        {
            "char": d["char"],
            "start_time": round(d["start_offset"] * speech_time_offset, 2),
            "end_time": round(d["end_offset"] * speech_time_offset, 2),
        }
        for d in transcription.char_offsets[0]
    ]

    return phonemes


# def output_fn(words, content_type):
#     assert content_type == "application/json"
#     return json.dumps(words)
