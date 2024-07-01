
# Voicematch Backend

## Project Overview

Voicematch Backend is a serverless application designed for audio processing, YouTube audio extraction, and speech analysis. It provides RESTful APIs for downloading YouTube audio, extracting media information, and performing speech recognition and pitch evaluation with ML models deployed in separate containers. The project is built for scalable cloud deployment, leveraging AWS Lambda and DynamoDB, and is suitable for use cases such as voice matching, phoneme recognition, and audio analytics.


## Installation & Setup

1. **Clone the repository**
	 ```bash
	 git clone <repo-url>
	 cd voicematch-backend
	 ```

2. **Install dependencies**
	 ```bash
	 npm install
	 ```

3. **Set up environment variables**
	 - Copy `.env.example` to `.env` and fill in required values.
	 - Required variables: AWS credentials, region, custom endpoints.

4. **Build the project**
	 ```bash
	 npm run build
	 ```

5. **Run tests**
	 ```bash
	 npm test
	 ```

6. **Start locally (Serverless Offline)**
	 ```bash
	 npm run debug
	 ```

## Usage Examples

- **Download YouTube Audio**
	```
	GET /youtube/download?videoHash=<id>&trimOffset=10&trimDuration=30
	```
- **Get YouTube Video Info**
	```
	GET /youtube/info?videoHash=<id>
	```
- **Process Audio**
	```
	GET /audio/process?mediaId=<id>&processOffset=0&processDuration=30
	```

## Configuration

- **Environment Variables**: Managed via `.env` and `serverless.yml`.
- **Serverless Config**: `serverless.yml` defines AWS resources, Lambda functions, and IAM roles.
- **DynamoDB**: Table schema in `sls/resources.yml`.
- **API Endpoints**: Defined in `sls/functions.yml`.
- **Custom Endpoints**: ML models for speech/pitch analysis run locally (see `src/services/predictions.ts`).

## Development Guide

- **Linting**: 
	```bash
	npm run lint
	```
- **Formatting**:
	```bash
	npm run prettify
	```
- **Type Checking**:
	```bash
	npm run type-check
	```
- **Testing**:
	```bash
	npm test
	```
- **Contribution**: Fork, create feature branches, submit PRs. Ensure code passes lint, type checks, and tests.
- **CI/CD**: Scripts for build, test, and deploy are provided in `package.json`.

## Deployment

- **Deploy to AWS**
	```bash
	npm run deploy
	```
- **Deploy IAM Roles**
	```bash
	npm run deploy-roles
	```
- **Production Environment**: Configure `ENV` and `REGION` variables for deployment.
