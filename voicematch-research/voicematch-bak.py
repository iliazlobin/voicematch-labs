from transformers import pipeline
import gradio as gr
from datasets import Dataset, interleave_datasets
from datasets import Audio
from transformers import Wav2Vec2Processor, Wav2Vec2ForCTC
from datasets import load_dataset
# import torch

import tensorflow as tf
import tensorflow_hub as hub

import numpy as np
import matplotlib.pyplot as plt
import librosa
from librosa import display as librosadisplay

import logging
import math
import statistics
import sys

from IPython.display import Audio, Javascript
from scipy.io import wavfile

from base64 import b64decode

import music21
from pydub import AudioSegment

logger = logging.getLogger()
logger.setLevel(logging.ERROR)

print("tensorflow: %s" % tf.__version__)
print("librosa: %s" % librosa.__version__)

EXPECTED_SAMPLE_RATE = 16000

def convert_audio_for_model(user_file, output_file='converted_audio_file.wav'):
    audio = AudioSegment.from_file(user_file)
    audio = audio.set_frame_rate(EXPECTED_SAMPLE_RATE).set_channels(1)
    audio.export(output_file, format="wav")
    return output_file


audio = '/tmp/audioc28845dd1fae4617f7395509b5a4dfcfb694f2b2-0-100.wav'
converted_audio_file = convert_audio_for_model(audio)
converted_audio_file


# Loading audio samples from the wav file:
sample_rate, audio_samples = wavfile.read(converted_audio_file, 'rb')

# Show some basic information about the audio.
duration = len(audio_samples)/sample_rate
print(f'Sample rate: {sample_rate} Hz')
print(f'Total duration: {duration:.2f}s')
print(f'Size of the input: {len(audio_samples)}')


MAX_ABS_INT16 = 32768.0
audio_samples = audio_samples / float(MAX_ABS_INT16)

# We now feed the audio to the SPICE tf.hub model to obtain pitch and uncertainty outputs as tensors.
# spice_model = hub.load("https://tfhub.dev/google/spice/2")
# spice_model_output = spice_model.signatures["serving_default"](tf.constant(audio_samples, tf.float32))

# print(spice_model_output)

# pitch_outputs = spice_model_output["pitch"]
# uncertainty_outputs = spice_model_output["uncertainty"]

# # 'Uncertainty' basically means the inverse of confidence.
# confidence_outputs = 1.0 - uncertainty_outputs

# fig, ax = plt.subplots()
# fig.set_size_inches(20, 10)
# plt.plot(pitch_outputs, label='pitch')
# # print(pitch_outputs)
# plt.plot(confidence_outputs, label='confidence')
# plt.legend(loc="lower right")
# plt.show()
