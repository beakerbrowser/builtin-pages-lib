module.exports = class FileTree {
  constructor(archive) {
    this.archive = archive
  }

  async setup() {
    // list all files
    var entries = await this.archive.listFiles('/', {depth: false})

    // construct a tree structure
    this.rootNode = createNode({ type: 'directory', name: '/' })
    for (var k in entries) {
      let entry = entries[k]
      var path = entry.name.split('/').filter(Boolean)
      setNode(this.rootNode, path, entry)
    }
  }

  addNode (entry) {
    var path = entry.name.split('/').filter(Boolean)
    setNode(this.rootNode, path, entry)
  }
}

function createNode (entry) {
  var niceName
  var nameParts = entry.name.split('/')
  do {
    niceName = nameParts.pop()
  } while (!niceName && nameParts.length > 0)
  if (niceName.startsWith('buffer~~')) {
    niceName = 'Unsaved file'
  }
  if (entry.type === 'directory') {
    return {entry, niceName, children: {}}
  }
  return {entry, niceName}
}

function setNode (node, path, entry, i=0) {
  var subname = path[i]
  if (i >= path.length - 1) {
    // end of path, set/update the node
    if (!node.children[subname]) {
      node.children[subname] = createNode(entry)
    } else {
      node.children[subname].entry = entry
    }
  } else {
    // make sure folder exists
    if (!node.children[subname]) {
      // put a default folder entry there
      node.children[subname] = createNode({
        type: 'directory',
        name: path.slice(0, i).join('/')
      })
    }
    // descend
    setNode(node.children[subname], path, entry, i + 1)
  }
}