const emitStream = require('emit-stream')
const speedometer = require('speedometer')
const EventTarget = require('./event-target')
const { throttle, debounce } = require('../functions')

// constants
// =

// how much time to wait between throttle emits
const EMIT_CHANGED_WAIT = 500

// exported api
// =

module.exports = class ArchivesList extends EventTarget {
  constructor ({listenNetwork} = {}) {
    super()

    // declare attributes
    this.archives = []

    // wire up events
    beaker.archives.addEventListener('added', this.onAdd.bind(this))
    beaker.archives.addEventListener('removed', this.onRemove.bind(this))
    beaker.archives.addEventListener('updated', this.onUpdate.bind(this))
    if (listenNetwork) {
      beaker.archives.addEventListener('network-changed', this.onNetworkChange.bind(this))
    }

    // create a throttled 'change' emiter
    this.emitChanged = throttle(() => this.dispatchEvent({type: 'changed'}), EMIT_CHANGED_WAIT)
  }

  async setup (filter) {
    // fetch archives
    this.archives = await beaker.archives.list(filter)
    this.archives.sort(archiveSortFn)
  }

  // event handlers
  // =

  onAdd (e) {
    var archive = this.archives.find(a => a.url === e.details.url)
    if (archive) return
    beaker.archives.get(e.details.url).then(archive => {
      this.archives.push(archive)
      this.emitChanged()
    })
  }

  onRemove (e) {
    var index = this.archives.findIndex(a => a.url === e.details.url)
    if (index === -1) return
    this.archives.splice(index, 1)
    this.emitChanged()
  }

  onUpdate (e) {
    // find the archive being updated
    var archive = this.archives.find(a => a.url === e.details.url)
    if (archive) {
      // patch the archive
      for (var k in e.details) {
        archive[k] = e.details[k]
      }
      this.emitChanged()
    }
  }

  onNetworkChange (e) {
    // find the archive being updated
    var archive = this.archives.find(a => a.url === e.details.url)
    if (archive) {
      // patch the archive
      archive.peers = e.details.peerCount
      if (archive.peerHistory) {
        var now = Date.now()
        var lastHistory = archive.peerHistory.slice(-1)[0]
        if (lastHistory && (now - lastHistory.ts) < 10e3) {
          // if the last datapoint was < 10s ago, just update it
          lastHistory.peers = archive.peers
        } else {
          archive.peerHistory.push({
            ts: Date.now(),
            peers: archive.peers
          })
        }
      }
      this.emitChanged()
    }
  }
}

// helpers
// =

function archiveSortFn (a, b) {
  return (a.title||'Untitled').localeCompare(b.title||'Untitled')
}
