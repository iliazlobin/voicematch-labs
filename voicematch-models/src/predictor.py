from __future__ import absolute_import

import logging

from sagemaker.predictor import Predictor
from sagemaker.serializers import IdentitySerializer
from sagemaker.deserializers import StreamDeserializer

logger = logging.getLogger("sagemaker")


class PlainPyTorchPredictor(Predictor):
    """A Predictor for inference against PyTorch Endpoints.

    This is able to serialize Python lists, dictionaries, and numpy arrays to
    multidimensional tensors for PyTorch inference.
    """

    def __init__(
        self,
        endpoint_name,
        sagemaker_session=None,
        serializer=IdentitySerializer,
        deserializer=StreamDeserializer,
    ):
        """Initialize an ``PyTorchPredictor``.

        Args:
            endpoint_name (str): The name of the endpoint to perform inference
                on.
            sagemaker_session (sagemaker.session.Session): Session object which
                manages interactions with Amazon SageMaker APIs and any other
                AWS services needed. If not specified, the estimator creates one
                using the default AWS configuration chain.
            serializer (sagemaker.serializers.BaseSerializer): Optional. Default
                serializes input data to .npy format. Handles lists and numpy
                arrays.
            deserializer (sagemaker.deserializers.BaseDeserializer): Optional.
                Default parses the response from .npy format to numpy array.
        """
        super(PlainPyTorchPredictor, self).__init__(
            endpoint_name,
            sagemaker_session,
            serializer=serializer,
            deserializer=deserializer,
        )
