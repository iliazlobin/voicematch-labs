import axios from 'axios';

axios.defaults.withCredentials = true;

export async function recognizeWords(blob: Blob) {
  return await axios.put('http://localhost:9080/predictions/wordrecog', blob, {
    headers: {
      'Content-Type': 'application/octet-stream',
    }
  }).then((response) => {
    return response.data;
  });
}

export async function recognizePhonemes(blob: Blob) {
  return await axios.put('http://localhost:9080/predictions/phonerecog', blob, {
    headers: {
      'Content-Type': 'application/octet-stream',
    }
  }).then((response) => {
    return response.data;
  });
}

export async function evaluatePitch(blob: Blob) {
  return await axios.post('http://localhost:9080/predictions/pitcheval', blob, {
    headers: {
      'Content-Type': 'application/octet-stream',
    }
  }).then((response) => {
    return response.data;
  });
}

// addCluster(name) {
//   return axios.put('/api/cluster', { name: name }).then((response) => {
//     return response.data;
//   });
// }
