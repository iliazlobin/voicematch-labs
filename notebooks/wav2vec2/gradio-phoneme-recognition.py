from transformers import pipeline
import asdf as gr
from datasets import Dataset, interleave_datasets
from datasets import Audio
from transformers import Wav2Vec2Processor, Wav2Vec2ForCTC
from datasets import load_dataset
import torch

processor = Wav2Vec2Processor.from_pretrained(
    "facebook/wav2vec2-lv-60-espeak-cv-ft")
model = Wav2Vec2ForCTC.from_pretrained(
    "facebook/wav2vec2-lv-60-espeak-cv-ft")


def transcribe_audio(mic=None, file=None):
    if mic is not None:
        audio = mic
    elif file is not None:
        audio = file
    else:
        return "You must either provide a mic recording or a file"

    print(audio)
    ds = Dataset.from_dict({"audio": [audio]}).cast_column(
        "audio", Audio(sampling_rate=16_000))
    print(ds[0])
    input_values = processor(
        ds[0]["audio"]["array"], return_tensors="pt").input_values
    logits = model(input_values).logits
    predicted_ids = torch.argmax(logits, dim=-1)
    transcription = processor.batch_decode(
        predicted_ids, output_char_offsets=True)

    return transcription


gr.Interface(
    fn=transcribe_audio,
    inputs=[
        gr.Audio(source="microphone", type="filepath", optional=True),
        # gr.Audio(source="upload", type="filepath", optional=True),
    ],
    outputs="text",
).launch()
