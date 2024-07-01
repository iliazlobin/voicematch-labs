import json
import os
import secrets
import shutil

import numpy as np
import requests
import tensorflow as tf
import tensorflow_hub as hub
from pydub import AudioSegment
from scipy.io import wavfile

# Constants and formulas have been taken from:
# https://tfhub.dev/google/spice/2

SAMPLE_RATE = os.getenv("SAMPLE_RATE", 16000)
PITCH_TO_SAMPLES_RATIO = os.getenv("PITCH_TO_SAMPLES_RATIO", 512)
# CONFIDENCE_THRESHOLD = os.getenv("CONFIDENCE_THRESHOLD", 0.7)


# def model_fn(model_dir):
#     print(f"loading model from {model_dir}")
#     model = tf.saved_model.load(model_dir)

#     evaluate_pitch = model.signatures["serving_default"]

#     return evaluate_pitch


def handler(data, context):
    """Handle request.
    Args:
        data (obj): the request data
        context (Context): an object containing request and configuration details
    Returns:
        (bytes, string): data to return to client, (optional) response content type
    """

    print(f"context: {context}")

    content = data.read()

    processed_input = _process_input(content, context)
    response = requests.post(context.rest_uri, data=processed_input)
    print(f"response: {response}")
    return _process_output(response, context)


def _process_input(data, context):
    print(f"context: {context}")

    content_type = context.request_content_type
    print(f"content_type: {content_type}")

    suffix = secrets.token_hex(nbytes=24)
    ogg_file = f"/tmp/vm-{suffix}.ogg"

    print(
        f"saving file {ogg_file} of the {content_type} content type for processing")
    with open(ogg_file, "wb") as f:
        f.write(data)
        f.close()

    audio = AudioSegment.from_file(ogg_file)
    audio = audio.set_frame_rate(SAMPLE_RATE).set_channels(1)

    wav_file = f"/tmp/vm-{suffix}.wav"
    audio.export(wav_file, format="wav")
    print(f"file to be procesesed: {wav_file}, {SAMPLE_RATE} Hz")

    sample_rate, audio_samples = wavfile.read(wav_file, 'rb')
    if sample_rate != SAMPLE_RATE:
        raise Exception(
            f"Invalid sample rate: {sample_rate}, expected {SAMPLE_RATE}")

    return json.dumps({
        "instances": np.asarray(audio_samples).tolist()
    })


def _process_output(data, context):
    if data.status_code != 200:
        raise ValueError(data.content.decode('utf-8'))

    response_content_type = context.accept_header
    print(f"response_content_type: {response_content_type}")

    output = data.content
    print(f"output: {output}")

    output_json = json.loads(output)
    print(f"output_json: {output_json}")

    predictions = output_json["predictions"]
    print(f"predictions: {predictions}")

    # prediction = output_json["predictions"][0]
    # print(f"prediction: {prediction}")

    # pitch_outputs = prediction["pitch"]
    # uncertainty_outputs = prediction["uncertainty"]
    # confidence_outputs = 1.0 - uncertainty_outputs

    # print(f"len(audio_samples): {len(audio_samples)}")
    # print(f"len(pitch_outputs): {len(pitch_outputs)}")
    # print(f"len(confidence_outputs): {len(confidence_outputs)}")

    # ratio = len(audio_samples) / len(pitch_outputs)
    # print(f"actual ration: {ratio}")

    ratio_offset = SAMPLE_RATE / PITCH_TO_SAMPLES_RATIO / 2 / 1000
    print(f"ratio_offset: {ratio_offset}")

    time_offset = PITCH_TO_SAMPLES_RATIO / SAMPLE_RATE
    print(f"time_offset: {time_offset}")

    pitch_levels = [
        {
            "time": i * time_offset + ratio_offset,
            "confidence": 1.0 - predictions[i]["uncertainty"],
            "pitch": predictions[i]["pitch"],
            "semitone": calculate_semitone(predictions[i]["pitch"])
        }
        for i in range(len(predictions))
    ]
    print(f"pitch_levels: {pitch_levels}")

    return json.dumps(pitch_levels), response_content_type


def calculate_semitone(pitch):
    return 25.58 + 63.07 * pitch
