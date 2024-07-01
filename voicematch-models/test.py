import json
import secrets

import sagemaker
from datasets import Audio, Dataset, interleave_datasets
from pydub import AudioSegment
from models.wordrecog.model.code.inference import input_fn, model_fn, predict_fn

model_dir = "models/wordrecog/model"
print(model_dir)

model = model_fn(model_dir)

ogg_audio = 'data/hello-hello.ogg'

with open(ogg_audio, 'rb') as f:
    audio_data = f.read()
print(audio_data)

input_data = input_fn(audio_data, "audio/ogg")
print('input_data: ', input_data)

words = predict_fn(input_data, model)
print('words: ', words)

# output_data = output_fn(words, "application/json")
# print('output_data: ', words)

# output = json.dumps(words)
# print('output: ', output)
