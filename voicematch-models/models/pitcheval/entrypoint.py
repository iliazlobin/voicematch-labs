from __future__ import absolute_import

import shlex
import subprocess
import sys
import shutil
import os
import glob

EXPORT_GLOB = os.getenv("EXPORT_GLOB", "/opt/ml/export/*")

model_dir = "/opt/ml/model/"

for file in glob.iglob(EXPORT_GLOB, recursive=True):
    file_name = os.path.basename(file)
    new_path = model_dir + file_name
    if not os.path.exists(new_path):
        shutil.move(file, new_path)
        print('Exported:', new_path)

if sys.argv[1] == 'serve':
    from sagemaker_pytorch_serving_container import serving
    serving.main()
else:
    subprocess.check_call(shlex.split(' '.join(sys.argv[1:])))

# prevent docker exit
subprocess.call(['tail', '-f', '/dev/null'])
