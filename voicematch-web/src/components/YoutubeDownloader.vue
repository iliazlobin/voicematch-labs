<template>
  <v-container class="pa-0 ma-0">
    <v-card>
      <v-card-title :text="youtubeTitle" class="text-h5">
        {{ youtubeTitle }}
      </v-card-title>

      <v-row class="pa-0 ma-0" no-gutters justify="space-around" align="center">
        <v-col class="pa-0 ma-0" align="center" cols="11">
          <v-sheet class="pa-2 ma-0" align="center">
            <v-text-field
              clearable
              label="YouTube URL"
              v-model="youtubeUrl"
              hide-details
              :rules="[youtubeUrlRule]"
              :loading="infoLoading > 0"
            />
          </v-sheet>
        </v-col>
        <v-col class="pb-0 ma-0" align="center" cols="1">
          <v-btn
            class="pa-2 ma-2"
            icon
            color="teal-darken-3"
            rounded="lg"
            :disabled="!selectMediaRange"
          >
            <v-icon
              icon="mdi-download"
              size="x-large"
              @click="(e) => downloadAndProcess()"
            ></v-icon>
          </v-btn>
        </v-col>
      </v-row>
      <v-row
        class="pt-8 pl-4 pr-4"
        no-gutters
        justify="space-around"
        align="center"
      >
        <v-range-slider
          v-model="selectMediaRange"
          thumb-label="always"
          thumb-size="14"
          hide-details
          min="0"
          :max="youtubeDuration"
          step="1"
          :disabled="!youtubeDuration"
        >
          <!-- <slot name="thumb-label">{{ minutes }}m {{ seconds }}s</slot> -->
          <template #thumb-label="{ modelValue }">
            {{ formatTime(modelValue) }}
          </template>
        </v-range-slider>
      </v-row>
    </v-card>
  </v-container>
</template>

<script setup lang="ts">
import { youtubeInfo } from "@/services/downloads";
import { youtubeDownload } from "@/services/downloads.ts";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { onMounted, ref, watch } from "vue";

const props = defineProps();
const emit = defineEmits(["update:audioBlob"]);

const youtubeUrl = ref("https://www.youtube.com/watch?v=WyoArevC9R4");
const infoLoading = ref(0);

const youtubeTitle = ref("---");
const youtubeDuration = ref<number | undefined>(undefined);
const selectMediaRange = ref<number[] | undefined>(undefined);

const thumbLabel = ref();

// const modelValue = ref(["1.2", "2.3"])

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  seconds = Math.floor(seconds % 60);
  return `${minutes.toString().padStart(1, "0")}:${seconds
    .toString()
    .padStart(2, "0")}`;
}

function youtubeUrlRule(input: string) {
  try {
    const url = new URL(input);
    const v = url.searchParams.get("v");
    if (
      url.hostname === "www.youtube.com" &&
      url.pathname === "/watch" &&
      v !== null
    ) {
      return true;
    }
  } catch (e) {}

  return "Invalid Youtube URL";
}

onMounted(() => {
  extractInfo();
});

watch(youtubeUrl, (url) => {
  extractInfo();
});

async function extractInfo() {
  const url = new URL(youtubeUrl.value);
  const videoHash = url.searchParams.get("v");
  if (videoHash === null) {
    return;
  }

  youtubeTitle.value = "...";
  youtubeDuration.value = undefined;
  selectMediaRange.value = undefined;

  infoLoading.value++;
  let result;
  try {
    result = await youtubeInfo(videoHash);
  } catch (e) {
    console.error(e);
    youtubeTitle.value = "---";
    return;
  } finally {
    infoLoading.value--;
  }

  youtubeTitle.value = result.title;
  youtubeDuration.value = result.duration;
  selectMediaRange.value = [0, result.duration];
}

const audioBlob = ref();

watch(audioBlob, (d) => {
  emit("update:audioBlob", d);
});

const s3Client = new S3Client({
  region: "us-east-1",
  credentials: {
    accessKeyId: import.meta.env.VITE_AWS_ACCESS_KEY,
    secretAccessKey: import.meta.env.VITE_AWS_ACCESS_SECRET_KEY,
  },
  tls: false,
});

async function downloadAndProcess() {
  const videoUrl = new URL(youtubeUrl.value);
  const videoHash = videoUrl.searchParams.get("v") ?? "";

  const offset = selectMediaRange.value?.[0] ?? 0;
  const duration = selectMediaRange.value?.[1]
    ? selectMediaRange.value?.[1] - offset
    : undefined;

  console.info("! downloading", videoHash, offset, duration);

  const result = await youtubeDownload({
    videoHash: videoHash,
    trimOffset: offset,
    trimDuration: duration ?? youtubeDuration.value,
    mediaDuration: youtubeDuration.value,
  });

  const output = await s3Client.send(
    new GetObjectCommand({
      Bucket: result.bucket,
      Key: result.key,
    })
  );

  console.debug("! downloaded", result, output);

  const stream = output.Body;

  const response = new Response(stream as BodyInit);
  const blob = await response.blob();

  const url = URL.createObjectURL(blob);

  audioBlob.value = {
    blob: blob,
    url: url,
    duration: youtubeDuration.value,
    selectRange: selectMediaRange.value,
    youtubeUrl: youtubeUrl.value,
    videoHash: videoHash,
    mediaId: result.mediaId,
  };
}
</script>
