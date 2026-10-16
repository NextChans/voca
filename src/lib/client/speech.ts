'use client';

/**
 * 영어 발음 재생
 *  - text: 기기 내장 speechSynthesis(en-US) 우선, 영어 음성이 없으면 /api/tts?text= 로 폴백
 *  - itemId: 시험 중 철자 문항. 정답 철자를 브라우저에 보내지 않기 위해 서버가 문항 id 로 음성을 합성
 */
let currentAudio: HTMLAudioElement | null = null;

function pickEnglishVoice(): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  return (
    voices.find((v) => v.lang === 'en-US' && /samantha|google|natural|aria|jenny/i.test(v.name)) ??
    voices.find((v) => v.lang === 'en-US') ??
    voices.find((v) => v.lang.startsWith('en')) ??
    null
  );
}

function stopAll() {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel();
  currentAudio?.pause();
  currentAudio = null;
}

async function playUrl(url: string): Promise<void> {
  stopAll();
  const audio = new Audio(url);
  currentAudio = audio;
  await audio.play();
}

export async function speakText(text: string, rate = 0.85): Promise<void> {
  const voice = pickEnglishVoice();
  if (voice) {
    stopAll();
    const u = new SpeechSynthesisUtterance(text);
    u.voice = voice;
    u.lang = voice.lang;
    u.rate = rate;
    window.speechSynthesis.speak(u);
    return;
  }
  await playUrl(`/api/tts?text=${encodeURIComponent(text)}`);
}

export async function speakItem(itemId: string): Promise<void> {
  await playUrl(`/api/tts?item=${encodeURIComponent(itemId)}`);
}

// 일부 브라우저는 voices 를 비동기로 로드하므로 미리 깨워둔다
if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  window.speechSynthesis.getVoices();
}
