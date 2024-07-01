FROM 763104351884.dkr.ecr.us-east-1.amazonaws.com/pytorch-inference:1.13.1-cpu-py39-ubuntu20.04-sagemaker

# DEBUG
RUN apt update
RUN apt install -y vim less curl

# install Hugging Face libraries and its dependencies
ARG TRANSFORMERS_VERSION=4.26.0

RUN pip install --no-cache-dir \
	transformers[sentencepiece,audio,vision]==${TRANSFORMERS_VERSION} \
  "sagemaker-huggingface-inference-toolkit<3" \
  datasets pydub

RUN apt install -y ffmpeg
RUN apt clean

COPY entrypoint.py /usr/local/bin/dockerd-entrypoint.py
COPY model /opt/ml/export

# advanced configuration
COPY config/log4j2.xml /opt/conda/lib/python3.9/site-packages/sagemaker_pytorch_serving_container/etc/log4j2.xml

COPY config/config.properties /opt/config.properties
# ENV TS_CONFIG_FILE=/opt/config.properties

# ENV TS_BENCHMARK=true

# configuration
ENV TS_DEFAULT_WORKERS_PER_MODEL=1
ENV TS_DEFAULT_RESPONSE_TIMEOUT=30
# ENV TS_LOAD_MODELS=ALL
ENV TS_DECODE_INPUT_REQUEST=false
