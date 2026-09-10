$ErrorActionPreference = "Stop"

$outDir = Join-Path $PSScriptRoot "..\public\audio"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

$items = @(
  @{
    Name = "voice-storage-full.wav"
    Text = "It always happens at the worst time. You're about to capture the moment, and your phone says storage is full. So I open CleanSwipe. It finds the obvious clutter first: duplicate photos, blurry shots, screenshots, and giant videos. I still review everything before deleting. Then I'm back to filming, with space for the moment that actually matters."
  },
  @{
    Name = "voice-camera-roll-reset.wav"
    Text = "Don't try to clean your entire camera roll in one night. That's why it never gets done. Just pick one month in CleanSwipe. Swipe right for the photos you want to keep, swipe left for the ones you don't. Before anything is deleted, you review the list. Ten minutes a week is enough to keep your camera roll from turning into a storage problem."
  },
  @{
    Name = "voice-smart-clean.wav"
    Text = "I don't want an app deleting my memories for me. I want it to find the mess, and let me decide. CleanSwipe scans for duplicate photos, similar shots, blurry pictures, screenshots, memes, and large files. Then I review the results myself. So the boring first pass is handled, but the final decision is still mine."
  },
  @{
    Name = "voice-big-video-flight.wav"
    Text = "Before a trip, I check one thing on my phone: the giant videos. They take up space faster than anything else. CleanSwipe shows me the heavy files, lets me compress a video, and then compare the result. If it still looks good, I can keep the smaller copy and decide what to do with the original. More space before I even leave."
  },
  @{
    Name = "voice-convert-before-send.wav"
    Text = "You know that message: Can you send it in a different format? I used to search for random converter sites. Now I use CleanSwipe Studio. Pick a photo or video, choose the available format, and convert it on your phone. Cleanup, compression, and media conversion in one place."
  }
)

foreach ($item in $items) {
  $path = Join-Path $outDir $item.Name
  if (Test-Path -LiteralPath $path) {
    Remove-Item -LiteralPath $path -Force
  }

  $voice = New-Object -ComObject SAPI.SpVoice
  $stream = New-Object -ComObject SAPI.SpFileStream
  $format = New-Object -ComObject SAPI.SpAudioFormat
  $format.Type = 22
  $stream.Format = $format
  $stream.Open($path, 3, $false)
  $voice.AudioOutputStream = $stream
  $voice.Rate = 1
  $voice.Volume = 100
  [void]$voice.Speak($item.Text)
  $stream.Close()
  Write-Output $path
}
