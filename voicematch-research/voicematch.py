from transformers import pipeline
import gradio as gr
from datasets import Dataset, interleave_datasets
from datasets import Audio
from transformers import Wav2Vec2Processor, Wav2Vec2ForCTC
from datasets import load_dataset
import torch

import tensorflow as tf
import tensorflow_hub as hub

import numpy as np
import librosa
import logging
from scipy.io import wavfile
from base64 import b64decode

from pydub import AudioSegment

import gradio as gr
import pandas as pd
import plotly.graph_objects as go
from datasets import load_dataset

import pandas as pd
import plotly.express as px
import plotly
from scipy import signal


logger = logging.getLogger()
logger.setLevel(logging.ERROR)

SAMPLE_RATE = 16000


def convert_audio_for_model(user_file, output_file='converted_audio_file.wav'):
    audio = AudioSegment.from_file(user_file)
    audio = audio.set_frame_rate(SAMPLE_RATE).set_channels(1)
    audio.export(output_file, format="wav")
    return output_file


pitch_model = hub.load("https://tfhub.dev/google/spice/2")
speech_processor = Wav2Vec2Processor.from_pretrained(
    "facebook/wav2vec2-base-960h")
speech_model = Wav2Vec2ForCTC.from_pretrained(
    "facebook/wav2vec2-base-960h")
phoneme_processor = Wav2Vec2Processor.from_pretrained(
    "facebook/wav2vec2-lv-60-espeak-cv-ft")
phoneme_model = Wav2Vec2ForCTC.from_pretrained(
    "facebook/wav2vec2-lv-60-espeak-cv-ft")
# phoneme_processor = Wav2Vec2Processor.from_pretrained(
#     "speech31/wav2vec2-large-english-TIMIT-phoneme_v3")
# phoneme_model = Wav2Vec2ForCTC.from_pretrained(
#     "speech31/wav2vec2-large-english-TIMIT-phoneme_v3")


def transcribe_audio(mic=None, file=None):
    if mic is not None:
        audio = mic
    elif file is not None:
        audio = file
    else:
        return "You must either provide a mic recording or a file"

    # audio = '/tmp/audioc28845dd1fae4617f7395509b5a4dfcfb694f2b2-0-100.wav'
    print(audio)
    converted_audio_file = convert_audio_for_model(audio)

    sample_rate, audio_samples = wavfile.read(converted_audio_file, 'rb')

    duration = len(audio_samples)/sample_rate
    print(f'Sample rate: {sample_rate} Hz')
    print(f'Total duration: {duration:.2f}s')
    print(f'Size of the input: {len(audio_samples)}')

    MAX_ABS_INT16 = 32768.0
    audio_samples = audio_samples / float(MAX_ABS_INT16)

    waveform_fig = go.Figure(data=go.Scatter(y=audio_samples))
    waveform_fig.update_layout(height=200)
    # waveform_fig.update_xaxes(range=[0, duration], fixedrange=True)

    # waveform_fig.update_layout(
    #     xaxis_title='Time (samples)',
    #     yaxis_title='Amplitude',
    # )

    # f, t, Sxx = signal.spectrogram(audio_samples, fs=SAMPLE_RATE, window='hann',
    #                                nperseg=1024, noverlap=512)

    # spectogram_fig = go.Figure(data=go.Heatmap(x=t, y=f, z=Sxx))

    # spectogram_fig.update_layout(
    #     xaxis_title='Time (s)',
    #     yaxis_title='Frequency (Hz)',
    #     title='Spectrogram of Audio Samples'
    # )

    # process pitch
    pitch_model_output = pitch_model.signatures["serving_default"](
        tf.constant(audio_samples, tf.float32))

    pitch_outputs = pitch_model_output["pitch"]
    uncertainty_outputs = pitch_model_output["uncertainty"]
    confidence_outputs = 1.0 - uncertainty_outputs

    confidence_outputs_list = list(confidence_outputs)
    pitch_outputs_list = [float(x) for x in pitch_outputs]

    indices = range(len(pitch_outputs_list))
    confident_pitch_outputs = [(i, p) for i, p, c in zip(
        indices, pitch_outputs, confidence_outputs_list) if c >= 0.75]
    confident_pitch_outputs_x, confident_pitch_outputs_y = zip(
        *confident_pitch_outputs)

    pitch_time_offset = 1.98 / 62
    # print(pitch_time_offset)
    # pitch_time_offset = inputs_to_logits_ratio / 16000
    inputs_to_logits_ratio = pitch_time_offset * 16000
    print(inputs_to_logits_ratio)

    inputs_to_logits_ratio = 500
    pitch_time_offset = inputs_to_logits_ratio / 16000
    print(pitch_time_offset)

    pitch_offsets = [
        {
            # "x": x,
            "time": x * pitch_time_offset,
            "pitch": y,
            # "start_time": round(d["start_offset"] * time_offset, 2),
            # "end_time": round(d["end_offset"] * time_offset, 2),
        }
        for x, y in zip(confident_pitch_outputs_x, confident_pitch_outputs_y)
    ]

    print(pitch_offsets)

    confident_pitch_outputs_ts = [
        x * pitch_time_offset for x in confident_pitch_outputs_x]
    # print(confident_pitch_outputs_ts)

    pitch_trace = go.Scatter(y=pitch_outputs, mode='lines')
    confidence_trace = go.Scatter(y=confidence_outputs, mode='lines')
    confident_pitch_trace = go.Scatter(
        x=confident_pitch_outputs_ts, y=confident_pitch_outputs_y, mode='markers')

    # pitch_model_fig = go.Figure(data=[pitch_trace, confidence_trace])
    # pitch_model_fig = go.Figure(data=[pitch_trace, confidence_trace, confident_pitch_trace])
    pitch_model_fig = go.Figure(data=[confident_pitch_trace])

    # process words
    speech_ds = Dataset.from_dict({"audio": [converted_audio_file]}).cast_column(
        "audio", Audio(sampling_rate=16_000))

    speech_input_values = speech_processor(
        speech_ds[0]["audio"]["array"], return_tensors="pt", padding="longest").input_values

    # retrieve logits
    words_logits = speech_model(speech_input_values).logits

    # take argmax and decode
    predicted_ids = torch.argmax(words_logits, dim=-1)
    transcription = speech_processor.batch_decode(
        predicted_ids, output_word_offsets=True)

    speech_time_offset = speech_model.config.inputs_to_logits_ratio / 16000
    print("speech_time_offset: ${speech_time_offset}")

    word_offsets = [
        {
            "word": d["word"],
            "start_time": round(d["start_offset"] * speech_time_offset, 2),
            "end_time": round(d["end_offset"] * speech_time_offset, 2),
        }
        for d in transcription.word_offsets[0]
    ]

    # process phonemes
    phonemes_logits = phoneme_model(speech_input_values).logits

    predicted_ids = torch.argmax(phonemes_logits, dim=-1)
    transcription = phoneme_processor.batch_decode(
        predicted_ids, output_char_offsets=True)

    char_time_offset = phoneme_model.config.inputs_to_logits_ratio / 16000
    print("char_time_offset: ${char_time_offset}")

    char_offsets = [
        {
            "char": d["char"],
            "start_time": round(d["start_offset"] * char_time_offset, 2),
            "end_time": round(d["end_offset"] * char_time_offset, 2),
        }
        for d in transcription.char_offsets[0]
    ]

    print(char_offsets)

    # process letters
    import matplotlib.offsetbox as offsetbox
    from scipy import stats
    import numpy as np

    # fig, ax = plt.subplots()
    # fig.set_size_inches(20, 10)
    # ax.set_ylim([0, 1])

    pitch_times = [o["time"] for o in pitch_offsets]
    pitch_values = [o["pitch"] for o in pitch_offsets]

    all_offsets = []
    for c in char_offsets:

        start_time = c["start_time"]
        end_time = c["end_time"]

        start_pitch = np.interp(start_time, pitch_times, pitch_values)
        end_pitch = np.interp(end_time, pitch_times, pitch_values)

        all_offsets.append({
            "char": c["char"],
            "start_time": start_time,
            "end_time": end_time,
            "start_pitch": start_pitch,
            "end_pitch": end_pitch,
        })

    print(all_offsets)

    offsets_fig = go.Figure()
    # offsets_fig.update_layout(dragmode='drawline', drawdirection='vertical')
    offsets_fig.update_layout(showlegend=False)
    offsets_fig.update_layout(xaxis={'fixedrange': False}, yaxis={'fixedrange': True})
    offsets_fig.update_xaxes(range=[0, duration])

    for c in all_offsets:
        mid_time = (c["start_time"] + c["end_time"]) / 2
        mid_pitch = (c["start_pitch"] + c["end_pitch"]) / 2

        offsets_fig.add_trace(go.Scatter(
            x=[c["start_time"], mid_time, c["end_time"]],
            y=[c["start_pitch"], mid_pitch, c["end_pitch"]],
            mode="lines+text",
            text=["", "<b>" + c["char"] + "</b>", ""],
            textposition="middle center",
            line=dict(color='rgba(80, 207, 255, 0.7)', width=3),
            textfont=dict(
                family="sans serif",
                size=18,
                color="indianred",
            )
        ))

        offsets_fig.add_trace(go.Scatter(
            x=[c["start_time"]],
            y=[c["start_pitch"]],
            mode="markers",
            marker=dict(color='rgba(80, 207, 255, 0.7)')
        ))

    print(word_offsets)

    for w in word_offsets:
        mid_time = (w["start_time"] + w["end_time"]) / 2

        offsets_fig.add_trace(go.Scatter(
            x=[w["start_time"], mid_time, w["end_time"]],
            y=[0.1, 0.1, 0.1],
            mode="lines+text",
            text=["", "<b>" + w["word"] + "</b>", ""],
            textposition="top center",
            line=dict(color='rgba(75, 233, 117, 0.7)', width=3),
            textfont=dict(
                family="sans serif",
                size=14,
                color="indianred",
            )
        ))

    return [waveform_fig, pitch_model_fig, offsets_fig]


with gr.Blocks() as demo:
    with gr.Column():
        with gr.Row():
            upload_file = gr.Audio(source="upload", type="filepath", optional=True)
        mic_file = gr.Audio(source="microphone", type="filepath", optional=True)
        process_button = gr.Button(value="Process")
        offsets_plot = gr.Plot()
        pitch_model_plot = gr.Plot()
        waveform_plot = gr.Plot()
    process_button.click(transcribe_audio, [mic_file, upload_file],
              [waveform_plot, pitch_model_plot, offsets_plot])

demo.launch()
