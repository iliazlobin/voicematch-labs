
# Voicematch Models

## Project Overview

Voicematch Models is a toolkit and container suite for advanced speech and audio analysis, including word recognition, phoneme recognition, and pitch evaluation. It provides ready-to-deploy Docker images, model artifacts, and serving scripts for local development, cloud deployment (AWS SageMaker, TorchServe), and integration into larger audio analytics pipelines.

## Features

- **Multiple Model Types**: Word, phoneme/character, and pitch evaluation models.
- **Inference Handlers**: Custom Python handlers for Hugging Face Transformers (Wav2Vec2) and TensorFlow models.
- **Containerized Serving**: Dockerfiles for SageMaker PyTorch/HuggingFace and DJL inference runtimes.
- **TorchServe & SageMaker Integration**: Entrypoint scripts and config files for seamless deployment.
- **Debug & Test Utilities**: Scripts and sample data for local validation.
- **Flexible Configuration**: Environment variables and config files for runtime customization.

## Architecture / Tech Stack

- **Languages**: Python 3.8+, Bash
- **Frameworks**: PyTorch, Hugging Face Transformers, TensorFlow, pydub, datasets, scipy
- **Serving**: Docker, TorchServe, AWS SageMaker, DJL Inference
- **Infrastructure**: Local, container, and cloud (AWS) deployment

```
Audio File
	|
	v
Container Entrypoint (entrypoint.py)
	|
	v
Model Handler (inference.py)
	|         |         |
	|         |         |
WordRecog  Phonerecog  Pitcheval
(Wav2Vec2) (Wav2Vec2)  (Spice)
```

## Model Overview

This project uses two main model architectures for speech and audio analysis:

### Wav2Vec2 (Hugging Face Transformers)

- **Purpose**: Word and phoneme/character recognition.
- **Description**: Wav2Vec2 is a transformer-based model for automatic speech recognition (ASR). It learns representations directly from raw audio and is widely used for transcribing speech to text and extracting phonetic features.
- **Reference**: [Hugging Face Wav2Vec2 Documentation](https://huggingface.co/docs/transformers/en/model_doc/wav2vec2)

### SPICE (TensorFlow Hub)

- **Purpose**: Pitch evaluation.
- **Description**: SPICE (Self-supervised Pitch Estimation) is a TensorFlow model designed to estimate pitch and confidence from audio signals. It is robust to different speakers and background noise, making it suitable for music and speech pitch analysis.
- **Reference**: [TensorFlow Hub SPICE Tutorial](https://www.tensorflow.org/hub/tutorials/spice)

These models are integrated via custom inference handlers and containerized for scalable deployment.


## Installation & Setup

### Prerequisites

- Docker (v20+)
- Python 3.8+ (for local scripts)
- ffmpeg (system package, required by pydub)
- AWS CLI (for cloud deployment, optional)

### Steps

1. **Clone the repository**
	```bash
	git clone <repo-url>
	cd voicematch-models
	```

2. **Install Python dependencies (for local dev)**
	```bash
	pip install -U pip
	pip install transformers datasets pydub soundfile scipy torch torchvision torchaudio sagemaker
	```

3. **Build a model container (example: wordrecog)**
	```bash
	cd models/wordrecog
	docker build -t voicematch-wordrecog:latest .
	```

4. **Prepare model artifacts**
	- Place your model `.tar.gz` files in a local folder.
	- Mount to `/opt/ml/model` inside the container, or use `/opt/ml/export/*` for auto-import.

5. **Run the container**
	```bash
	docker run --rm -it -p 8080:8080 -v $(pwd)/model:/opt/ml/model voicematch-wordrecog:latest serve
	```

6. **(Optional) Use docker-compose for local stack**
	```bash
	docker-compose -f test/docker-compose.yaml up --build
	```

## Usage Examples

- **List available models**
	```bash
	curl -X GET http://localhost:8080/models
	```

- **Send audio for prediction**
	```bash
	curl -X POST http://localhost:8080/predictions/model -T data/hello-hello.ogg
	```

- **Expected outputs**
	- *wordrecog*: `[{"word": "...", "start_time": ..., "end_time": ...}, ...]`
	- *phonerecog*: `[{"char": "...", "start_time": ..., "end_time": ...}, ...]`
	- *pitcheval*: `[{"time": ..., "confidence": ..., "pitch": ..., "semitone": ...}, ...]`

- **Python example**
	```python
	from src import predictor
	# See test/inference.py for a demo loading model_fn and running predict_fn
	```

## Configuration

- **Environment Variables**
	- `SAMPLE_RATE` (default: 16000)
	- `PITCH_TO_SAMPLES_RATIO` (for pitcheval)
	- `EXPORT_GLOB` (default: /opt/ml/export/*)
	- `TS_CONFIG_FILE`, `TS_MODEL_STORE`, `SAGEMAKER_MULTI_MODEL` (TorchServe/SageMaker)

- **Config Files**
	- `config.properties` (runtime settings)
	- `log4j2.xml` (Java logging for TorchServe)
	- `.env` (for local scripts, if needed)

- **Model Artifacts**
	- Place `.tar.gz` files in `/opt/ml/model` or `/opt/ml/export/` for auto-import.

## Development Guide

- **Debug scripts**
	```bash
	python3 test/inference.py
	```

- **Linting & Formatting**
	- Recommended: `black`, `flake8` for Python code.

- **Testing**
	- Add unit tests to `test/` for new features or bug fixes.

- **Contribution**
	1. Fork and create a feature branch.
	2. Add tests and update documentation.
	3. Submit a pull request with a clear description.

- **CI/CD**
	- Run lint, tests, and build Docker images.
	- For SageMaker: upload model artifacts to S3 and deploy via pipeline.

## Deployment

- **Docker / TorchServe**
	- Build and run containers as above.
	- Expose port 8080 for REST API.

- **AWS SageMaker**
	- Build image, push to ECR, deploy as endpoint.
	- Use SageMaker PyTorchModel/HuggingFaceModel helpers.

- **Kubernetes / Cloud Run**
	- Deploy built images, mount model artifacts, start with `serve`.

## Troubleshooting

- Ensure `ffmpeg` is installed and on PATH for audio conversion.
- For large models, use GPU-enabled containers and sufficient resources.
- Entry points auto-import model files from `/opt/ml/export/` to `/opt/ml/model`.

## License & Contact

This repository does not include a LICENSE file. Please add a suitable open-source license before publishing.

For questions or contributions, review the code in `models/*/model/code/inference.py` and Dockerfiles in `docker/`.

---

This README provides a complete, beginner-friendly guide for getting started, developing, and deploying Voicematch Models. For further details, see the code and configuration files in the repository.


torchserve --start --model-store /.sagemaker/ts/models --ts-config /etc/sagemaker-ts.properties --log-config /opt/conda/lib/python3.9/site-packages/sagemaker_pytorch_serving_container/etc/log4j2.xml --models model=/opt/ml/model
# java -Dmodel_server_home=/opt/conda/lib/python3.9/site-packages -Dlog4j.configurationFile=file:///opt/conda/lib/python3.9/site-packages/sagemaker_pytorch_serving_container/etc/log4j2.xml -Djava.io.tmpdir=/home/model-server/tmp -cp .:/opt/conda/lib/python3.9/site-packages/ts/frontend/* org.pytorch.serve.ModelServer --python /opt/conda/bin/python3.9 -f /etc/sagemaker-ts.properties -s /.sagemaker/ts/models -w /.sagemaker/ts/models -m model=/opt/ml/model

# configure
# vi /etc/sagemaker-ts.properties
vi /opt/config.properties
# vi /opt/log4j2.xml
vi /opt/conda/lib/python3.9/site-packages/sagemaker_pytorch_serving_container/etc/log4j2.xml

# vi /home/model-server/config.properties
vi /logs/config/20230308054131215-startup.cfg
# vi /etc/sagemaker-ts.properties
vi /opt/ml/model/code/inference.py

# vi /opt/conda/lib/python3.9/site-packages/sagemaker_inference/etc/log4j2.xml
vi /opt/conda/lib/python3.9/site-packages/sagemaker_pytorch_serving_container/etc/log4j2.xml

# vi /usr/local/bin/dockerd-entrypoint.sh

# docker cp /root/ws/ml/voicematch-models/model-v3.tar.gz 2cb2ec5518c7:/opt/ml/model/model-v3.tar.gz
# docker cp /root/ws/ml/voicematch-models/model-v3.tar.gz 2cb2ec5518c7:/opt/ml/model/model-v3b.tar.gz
# docker cp /root/ws/ml/voicematch-models/voicematch.tar.gz 2cb2ec5518c7:/opt/ml/model/voicematch.tar.gz
# docker cp /root/ws/ml/voicematch-models/voicematch-v4.tar.gz 2cb2ec5518c7:/opt/ml/model/voicematch-v4.tar.gz
docker cp /root/ws/ml/voicematch-models/voicematch-v3b.tar.gz 2cb2ec5518c7:/opt/ml/model/voicematch-v3b.tar.gz
docker cp /root/ws/ml/voicematch-models/voicematch-bin.tar.gz 2cb2ec5518c7:/opt/ml/model/voicematch-bin.tar.gz
docker cp /root/ws/ml/voicematch-models/model/code/inference.py 2cb2ec5518c7:/opt/ml/model/code/inference.py

cd /opt/ml/model/ && ls -la
tar xvfz voicematch-v3b.tar.gz
tar xvfz voicematch-bin.tar.gz
# ls /opt/ml/model/voicematch-v4.tar.gz

# predictions
docker cp /root/ws/ml/voicematch-models/data/hello-hello.ogg 013442b880e0:/opt/hello-hello.ogg

# api
curl -X OPTIONS http://localhost:8080
curl -X GET http://localhost:8080/models
curl -X GET http://localhost:8080/models/model

curl http://localhost:8080/predictions/model -T /opt/hello-hello.ogg
curl http://localhost:8080/predictions/model -T /root/ws/ml/voicematch-models/data/hello-hello.ogg

```
