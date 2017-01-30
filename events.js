import * as yo from 'yo-yo'

export function writeToClipboard (str) {
  var textarea = yo`<textarea>${str}</textarea>`
  document.body.appendChild(textarea)
  textarea.select()
  document.execCommand('copy')
  document.body.removeChild(textarea)
}