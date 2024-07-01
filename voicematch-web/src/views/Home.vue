<template>
  <!-- <SourceControl :audioBlob="youtubeAudioBlob" @update:audioChart="e => sourceAudioChart = e" :controlPlay="controlPlay" :controlPlaybackRate="controlPlaybackRate" :conrtolBalanceLevel="conrtolBalanceLevel" /> -->
  <PlaybackControl :recordingAudioBlob="recordingAudioBlob" :sourceAudioBlob="youtubeAudioBlob"/>
  <YoutubeDownloader @update:audioBlob="e => youtubeAudioBlob = e" />
  <!-- <RecordingControl @update:audioBlob="e => recordingAudioBlob = e" /> -->
</template>

<script setup>
import PlaybackControl from '@/components/PlaybackControl.vue';
import RecordingControl from '@/components/RecordingControl.vue';
import YoutubeDownloader from '@/components/YoutubeDownloader.vue';
import { ref } from 'vue';

const youtubeAudioBlob = ref()
const sourceAudioChart = ref()
const recordingAudioBlob = ref()
const controlPlay = ref()
const controlPlaybackRate = ref()
const conrtolBalanceLevel = ref()

// const navigateScroll = ref()
// const navigateScene = ref()

// const navigatePosition = ref()
// watchEffect(() => {
//   navigatePosition.value = navigateScroll.value
// })
// watchEffect(() => {
//   navigatePosition.value = navigateScene.value
// })

// watchEffect(() => {
//   // console.debug('! controlPlay: ', controlPlay.value)
//   // console.debug('! navigateScroll: ', navigateScroll.value)
//   // console.debug('! navigatePosition: ', navigatePosition.value)
// })

</script>
