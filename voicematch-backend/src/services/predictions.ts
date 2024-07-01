import axios from 'axios';
import { ReadStream } from 'fs';

axios.defaults.withCredentials = true;

export async function recognizeWords(stream: ReadStream) {
  let result = null;
  try {
    result = await axios.put('http://localhost:7081/predictions/model', stream, {
      headers: {
        'Content-Type': 'application/octet-stream',
      }
    });
  } catch (e) {
    throw new Error(`failed to recognize words: axios: ${e.code}, ${e.message}, ${e.response?.data?.message}`);
  }
  if (result.status !== 200) {
    throw new Error(`failed to recognize words: bad status: ${result.status}, ${result.statusText}`);
  }
  return result.data;
}

export async function recognizePhonemes(stream: ReadStream) {
  let result = null;
  try {
    result = await axios.put('http://localhost:7082/predictions/model', stream, {
      headers: {
        'Content-Type': 'application/octet-stream',
      }
    });
  } catch (e) {
    throw new Error(`failed to recognize phonemes: axios: ${e.code}, ${e.message}, ${e.response?.data?.message}`);
  }
  if (result.status !== 200) {
    throw new Error(`failed to recognize phonemes: bad status: ${result.status}, ${result.statusText}`);
  }
  return result.data;
}

export async function evaluatePitch(stream: ReadStream) {
  let result = null;
  try {
    result = await axios.post('http://localhost:7083/invocations', stream, {
      headers: {
        'Content-Type': 'application/octet-stream',
      }
    });
  } catch (e) {
    throw new Error(`failed to evaluate pitch: axios: ${e.code}, ${e.message}, ${e.response?.data?.message}`);
  }
  if (result.status !== 200) {
    throw new Error(`failed to evaluate pitch: bad status: ${result.status}, ${result.statusText}`);
  }
  return result.data;
}
