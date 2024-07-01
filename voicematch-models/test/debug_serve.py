from sagemaker.huggingface.model import HuggingFaceModel
from sagemaker.pytorch import PyTorchModel

role = "arn:aws:iam::908060038426:role/sagemaker-local-role"
model_s3_path = "s3://sagemaker-us-east-1-908060038426/model/voicematch/words/model-v2.tar.gz"

model = PyTorchModel(
    entry_point="inference.py",
    source_dir="dlc/voicematch-dlc/src",
    role=role,
    model_data=model_s3_path,
   #  framework_version="1.5.0",
   #  py_version="py3",
  #  image_uri='763104351884.dkr.ecr.us-east-1.amazonaws.com/pytorch-inference:1.13.1-cpu-py39-ubuntu20.04-sagemaker',
  #  image_uri='763104351884.dkr.ecr.us-east-1.amazonaws.com/pytorch-inference:1.13.1-gpu-py39-cu117-ubuntu20.04-sagemaker',
  #  image_uri='763104351884.dkr.ecr.us-west-2.amazonaws.com/djl-inference:0.21.0-deepspeed0.8.0-cu117',
   image_uri='voicematch:pytorch',
)

predictor = model.deploy(
    initial_instance_count=1,
    instance_type="local",
    container_startup_health_check_timeout=900,
)
