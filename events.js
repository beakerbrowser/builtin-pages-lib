const yo = require('yo-yo')

function writeToClipboard (str) {
  var textarea = yo`<textarea>${str}</textarea>`
  document.body.appendChild(textarea)
  textarea.select()
  document.execCommand('copy')
  document.body.removeChild(textarea)
}
exports.writeToClipboard = writeToClipboard