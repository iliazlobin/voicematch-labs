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

# COPY config.properties /home/model-server/config.properties
COPY config.properties /etc/sagemaker-ts.properties
# COPY log4j2.xml /home/model-server/log4j2.xml
COPY log4j2.xml /opt/conda/lib/python3.9/site-packages/sagemaker_pytorch_serving_container/etc/log4j2.xml
