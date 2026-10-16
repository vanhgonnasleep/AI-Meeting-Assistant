// Browser capture lifecycle, separated from the dock's rendering and timer.
export function createAudioRecording({ getUserMedia, Recorder, onStatusChange, onRecordedAudio, onError }) {
  let current = null;
  let disposed = false;
  const isCurrent = capture => !disposed && current === capture;
  const release = capture => {
    if (capture.recorder) {
      capture.recorder.ondataavailable = null;
      capture.recorder.onstop = null;
      capture.recorder.onerror = null;
      try {
        if (capture.recorder.state !== 'inactive') capture.recorder.stop();
      } catch { /* Tracks must still close if the encoder has already failed. */ }
    }
    capture.stream?.getTracks().forEach(track => track.stop());
  };
  const fail = (capture, error) => {
    const active = isCurrent(capture);
    release(capture);
    if (!active) return;
    current = null;
    onStatusChange('idle');
    onError(error);
  };
  return {
    async start() {
      if (disposed || current) return;
      const capture = { stream: null, recorder: null, chunks: [], stopping: false };
      current = capture;
      onStatusChange('starting');
      try {
        if (typeof Recorder !== 'function' || typeof getUserMedia !== 'function') {
          throw new Error('Audio recording is not supported in this browser environment.');
        }
        capture.stream = await getUserMedia({ audio: true });
        // Permission prompts cannot be aborted; invalidate their late results.
        if (!isCurrent(capture)) { release(capture); return; }
        const recorder = new Recorder(capture.stream);
        capture.recorder = recorder;
        recorder.ondataavailable = event => {
          if (isCurrent(capture) && event.data.size > 0) capture.chunks.push(event.data);
        };
        recorder.onstop = () => {
          if (!isCurrent(capture)) return;
          let file;
          try {
            if (!capture.chunks.length) throw new Error('No audio was captured. Please try recording again.');
            const type = recorder.mimeType || capture.chunks.find(chunk => chunk.type)?.type || '';
            const extension = { 'audio/webm': 'webm', 'video/webm': 'webm', 'audio/mp4': 'mp4',
              'video/mp4': 'mp4', 'audio/ogg': 'ogg', 'audio/wav': 'wav', 'audio/x-wav': 'wav',
              'audio/mpeg': 'mp3' }[type.split(';')[0].trim().toLowerCase()];
            if (!extension) throw new Error('This browser recording format is not supported. Please upload an audio file.');
            file = new File(capture.chunks, `recorded_meeting_${Date.now()}.${extension}`, { type });
          } catch (error) { fail(capture, error); return; }
          release(capture);
          current = null;
          onStatusChange('idle');
          onRecordedAudio(file);
        };
        recorder.onerror = event => fail(capture, event.error || new Error('Audio recording failed. Please try again.'));
        recorder.start(250);
        onStatusChange('recording');
      } catch (error) {
        fail(capture, error);
      }
    },
    stop() {
      const capture = current;
      if (!capture || disposed || capture.stopping) return;
      if (!capture.recorder) {
        current = null;
        onStatusChange('idle');
        return;
      }
      capture.stopping = true;
      onStatusChange('stopping');
      try {
        if (capture.recorder.state !== 'inactive') capture.recorder.stop();
        capture.stream.getTracks().forEach(track => track.stop());
      } catch (error) { fail(capture, error); }
      // Keep ownership until the queued final dataavailable/stop events arrive.
    },
    dispose() {
      disposed = true;
      const capture = current;
      current = null;
      if (capture) release(capture);
    },
  };
}
