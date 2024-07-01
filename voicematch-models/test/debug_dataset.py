# from inference import input_fn, model_fn, output_fn, predict_fn
from src.inference import input_fn, model_fn, predict_fn
import json
import sagemaker
from datasets import Dataset, interleave_datasets, Audio

model_dir = "model"
print(model_dir)

# load the model
model = model_fn(model_dir)
# print(model)

# simulate some input data to test transform_fn

# data = {"inputs": np.random.rand(16, 1, 28, 28).tolist()}
# data = {
#   "inputs": "the mesmerizing performances of the leads keep the film grounded and keep the audience riveted .",
# }

# # encode numpy array to binary stream
# serializer = sagemaker.serializers.JSONSerializer()

# jstr = serializer.serialize(data)
# jstr = json.dumps(data)

from scipy.io import wavfile
from pydub import AudioSegment

import soundfile as sf
# import sounddevice as sd

ogg_audio = '/root/ws/ml/dlc/voicematch-dlc/data/hello-hello.ogg'
wav_audio = '/root/ws/ml/dlc/voicematch-dlc/data/hello-hello.wav'

# audio = AudioSegment.from_file(ogg_audio)
# audio = audio.set_frame_rate(16000).set_channels(1)
# print('audio', audio)
# # audio_samples = audio.get_array_of_samples()
# # print('audio_samples', audio_samples)
# audio.export(wav_audio, format="wav")

# with open(wav_audio, 'rb') as f:
#     audio_data = f.read()
# print(audio_data)

# audio = Audio()

# audio_dataset = Dataset.from_dict({"audio": [wav_audio]}).cast_column("audio", Audio())
audio_dataset = Dataset.from_dict({"audio": [wav_audio]}).cast_column("audio", Audio())
print(audio_dataset)
print(audio_dataset[0]["audio"]['array'])
