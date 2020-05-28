import * as Process from 'child_process'
import * as Path from 'path'
import * as lsp from 'vscode-languageserver'

import { FIXTURE_FOLDER, FIXTURE_URI } from '../../../testing/fixtures'
import { getMockConnection } from '../../../testing/mocks'
import LspServer from '../server'
import { CompletionItemDataType } from '../types'

async function initializeServer() {
  const diagnostics: Array<lsp.PublishDiagnosticsParams | undefined> = []

  const connection = getMockConnection()

  const server = await LspServer.initialize(connection, {
    rootPath: FIXTURE_FOLDER,
    rootUri: null,
    processId: 42,
    capabilities: {} as any,
    workspaceFolders: null,
  })

  const { backgroundAnalysisCompleted } = server

  if (backgroundAnalysisCompleted) {
    await backgroundAnalysisCompleted
  }

  return {
    connection,
    console,
    diagnostics,
    server,
  }
}

describe('server', () => {
  it('initializes and responds to capabilities', async () => {
    const { server } = await initializeServer()
    expect(server.capabilities()).toMatchSnapshot()
  })

  it('register LSP connection', async () => {
    const { connection, server } = await initializeServer()

    server.register(connection)

    expect(connection.onHover).toHaveBeenCalledTimes(1)
    expect(connection.onDefinition).toHaveBeenCalledTimes(1)
    expect(connection.onDocumentSymbol).toHaveBeenCalledTimes(1)
    expect(connection.onWorkspaceSymbol).toHaveBeenCalledTimes(1)
    expect(connection.onDocumentHighlight).toHaveBeenCalledTimes(1)
    expect(connection.onReferences).toHaveBeenCalledTimes(1)
    expect(connection.onCompletion).toHaveBeenCalledTimes(1)
    expect(connection.onCompletionResolve).toHaveBeenCalledTimes(1)
  })

  it('responds to onHover', async () => {
    const { connection, server } = await initializeServer()
    server.register(connection)

    const onHover = connection.onHover.mock.calls[0][0]

    const result = await onHover(
      {
        textDocument: {
          uri: FIXTURE_URI.INSTALL,
        },
        position: {
          line: 25,
          character: 5,
        },
      },
      {} as any,
      {} as any,
    )

    expect(result).toBeDefined()
    expect(result).toEqual({
      contents: {
        kind: 'markdown',
        value: expect.stringContaining('remove directories'),
      },
    })
  })

  it('responds to onHover with function documentation extracted from comments', async () => {
    const { connection, server } = await initializeServer()
    server.register(connection)

    const onHover = connection.onHover.mock.calls[0][0]

    const result = await onHover(
      {
        textDocument: {
          uri: FIXTURE_URI.COMMENT_DOC,
        },
        position: {
          line: 17,
          character: 0,
        },
      },
      {} as any,
      {} as any,
    )

    expect(result).toBeDefined()
    expect(result).toEqual({
      contents:
        '### Function: **hello_world** - *defined on line 8*\n\n```txt\nthis is a comment\ndescribing the function\nhello_world\nthis function takes two arguments\n```',
    })
  })

  it('responds to onDocumentHighlight', async () => {
    const { connection, server } = await initializeServer()
    server.register(connection)

    const onDocumentHighlight = connection.onDocumentHighlight.mock.calls[0][0]

    const result1 = await onDocumentHighlight(
      {
        textDocument: {
          uri: FIXTURE_URI.ISSUE206,
        },
        position: {
          // FOO
          line: 0,
          character: 10,
        },
      },
      {} as any,
      {} as any,
    )

    // TODO: there is a superfluous range here on line 0:
    expect(result1).toMatchInlineSnapshot(`
      Array [
        Object {
          "range": Object {
            "end": Object {
              "character": 12,
              "line": 0,
            },
            "start": Object {
              "character": 9,
              "line": 0,
            },
          },
        },
        Object {
          "range": Object {
            "end": Object {
              "character": 12,
              "line": 0,
            },
            "start": Object {
              "character": 9,
              "line": 0,
            },
          },
        },
        Object {
          "range": Object {
            "end": Object {
              "character": 28,
              "line": 1,
            },
            "start": Object {
              "character": 25,
              "line": 1,
            },
          },
        },
      ]
    `)

    const result2 = await onDocumentHighlight(
      {
        textDocument: {
          uri: FIXTURE_URI.ISSUE206,
        },
        position: {
          // readonly cannot be parsed as a word
          line: 0,
          character: 0,
        },
      },
      {} as any,
      {} as any,
    )

    expect(result2).toMatchInlineSnapshot(`Array []`)
  })

  it('responds to onWorkspaceSymbol', async () => {
    const { connection, server } = await initializeServer()
    server.register(connection)

    const onWorkspaceSymbol = connection.onWorkspaceSymbol.mock.calls[0][0]

    async function lookupAndExpectNpmConfigLoglevelResult(query: string) {
      const result = await onWorkspaceSymbol(
        {
          query,
        },
        {} as any,
        {} as any,
      )

      expect(result).toEqual([
        {
          kind: expect.any(Number),
          location: {
            range: {
              end: { character: 27, line: 40 },
              start: { character: 0, line: 40 },
            },
            uri: expect.stringContaining('/testing/fixtures/install.sh'),
          },
          name: 'npm_config_loglevel',
        },
        {
          kind: expect.any(Number),
          location: {
            range: {
              end: { character: 31, line: 48 },
              start: { character: 2, line: 48 },
            },
            uri: expect.stringContaining('/testing/fixtures/install.sh'),
          },
          name: 'npm_config_loglevel',
        },
      ])
    }

    await lookupAndExpectNpmConfigLoglevelResult('npm_config_loglevel') // exact
    await lookupAndExpectNpmConfigLoglevelResult('config_log') // in the middle
    await lookupAndExpectNpmConfigLoglevelResult('npmloglevel') // fuzzy
  })

  it('responds to onCompletion with filtered list when word is found', async () => {
    const { connection, server } = await initializeServer()
    server.register(connection)

    const onCompletion = connection.onCompletion.mock.calls[0][0]

    const result = await onCompletion(
      {
        textDocument: {
          uri: FIXTURE_URI.INSTALL,
        },
        position: {
          // rm
          line: 25,
          character: 5,
        },
      },
      {} as any,
      {} as any,
    )

    // Limited set (not using snapshot due to different executables on CI and locally)
    expect(result && 'length' in result && result.length < 8).toBe(true)
    expect(result).toEqual(
      expect.arrayContaining([
        {
          data: {
            name: 'rm',
            type: CompletionItemDataType.Executable,
          },
          kind: expect.any(Number),
          label: 'rm',
        },
      ]),
    )
  })

  it('responds to onCompletion with options list when command name is found', async () => {
    // This doesn't work on all hosts:
    const getOptionsResult = Process.spawnSync(
      Path.join(__dirname, '../src/get-options.sh'),
      ['find', '-'],
    )

    if (getOptionsResult.status !== 0) {
      console.warn('Skipping onCompletion test as get-options.sh failed')
      return
    }

    const { connection, server } = await initializeServer()
    server.register(connection)

    const onCompletion = connection.onCompletion.mock.calls[0][0]

    const result = await onCompletion(
      {
        textDocument: {
          uri: FIXTURE_URI.OPTIONS,
        },
        position: {
          // grep --line-
          line: 2,
          character: 12,
        },
      },
      {} as any,
      {} as any,
    )

    expect(result).toEqual(
      expect.arrayContaining([
        {
          data: {
            name: expect.stringMatching(RegExp('--line-.*')),
            type: CompletionItemDataType.Symbol,
          },
          kind: expect.any(Number),
          label: expect.stringMatching(RegExp('--line-.*')),
        },
      ]),
    )
  })

  it('responds to onCompletion with entire list when no word is found', async () => {
    const { connection, server } = await initializeServer()
    server.register(connection)

    const onCompletion = connection.onCompletion.mock.calls[0][0]

    const result = await onCompletion(
      {
        textDocument: {
          uri: FIXTURE_URI.INSTALL,
        },
        position: {
          // empty space
          line: 26,
          character: 0,
        },
      },
      {} as any,
      {} as any,
    )

    // Entire list
    expect(result && 'length' in result && result.length).toBeGreaterThanOrEqual(50)
  })

  it('responds to onCompletion with empty list when word is a comment', async () => {
    const { connection, server } = await initializeServer()
    server.register(connection)

    const onCompletion = connection.onCompletion.mock.calls[0][0]

    const result = await onCompletion(
      {
        textDocument: {
          uri: FIXTURE_URI.INSTALL,
        },
        position: {
          // inside comment
          line: 2,
          character: 1,
        },
      },
      {} as any,
      {} as any,
    )

    expect(result).toEqual([])
  })

  it('responds to onCompletion with empty list when word is {', async () => {
    const { connection, server } = await initializeServer()
    server.register(connection)

    const onCompletion = connection.onCompletion.mock.calls[0][0]

    const result = await onCompletion(
      {
        textDocument: {
          uri: FIXTURE_URI.ISSUE101,
        },
        position: {
          // the opening brace '{' to 'add_a_user'
          line: 4,
          character: 0,
        },
      },
      {} as any,
      {} as any,
    )

    expect(result).toEqual([])
  })

  it('responds to onCompletion when word is found in another file', async () => {
    const { connection, server } = await initializeServer()
    server.register(connection)

    const onCompletion = connection.onCompletion.mock.calls[0][0]

    const resultVariable = await onCompletion(
      {
        textDocument: {
          uri: FIXTURE_URI.SOURCING,
        },
        position: {
          // $BLU (variable)
          line: 6,
          character: 7,
        },
      },
      {} as any,
      {} as any,
    )

    expect(resultVariable).toMatchInlineSnapshot(`
      Array [
        Object {
          "data": Object {
            "name": "BLUE",
            "type": 3,
          },
          "documentation": "### Variable: **BLUE** - *defined in ../extension.inc*",
          "kind": 6,
          "label": "BLUE",
        },
      ]
    `)

    const resultFunction = await onCompletion(
      {
        textDocument: {
          uri: FIXTURE_URI.SOURCING,
        },
        position: {
          // add_a_us (function)
          line: 8,
          character: 7,
        },
      },
      {} as any,
      {} as any,
    )

    expect(resultFunction).toMatchInlineSnapshot(`
      Array [
        Object {
          "data": Object {
            "name": "add_a_user",
            "type": 3,
          },
          "documentation": "### Function: **add_a_user** - *defined in ../issue101.sh*

      \`\`\`txt
      Helper function to add a user
      \`\`\`",
          "kind": 3,
          "label": "add_a_user",
        },
      ]
    `)
  })

  it('responds to onCompletion with local symbol when word is found in multiple files', async () => {
    const { connection, server } = await initializeServer()
    server.register(connection)

    const onCompletion = connection.onCompletion.mock.calls[0][0]

    const result = await onCompletion(
      {
        textDocument: {
          uri: FIXTURE_URI.SOURCING,
        },
        position: {
          // BOL (BOLD is defined in multiple places)
          line: 12,
          character: 7,
        },
      },
      {} as any,
      {} as any,
    )

    expect(result).toMatchInlineSnapshot(`
      Array [
        Object {
          "data": Object {
            "name": "BOLD",
            "type": 3,
          },
          "documentation": undefined,
          "kind": 6,
          "label": "BOLD",
        },
      ]
    `)
  })

  it('responds to onCompletion with all variables when starting to expand parameters', async () => {
    const { connection, server } = await initializeServer()
    server.register(connection)

    const onCompletion = connection.onCompletion.mock.calls[0][0]

    const result: any = await onCompletion(
      {
        textDocument: {
          uri: FIXTURE_URI.SOURCING,
        },
        position: {
          // $
          line: 14,
          character: 7,
        },
      },
      {} as any,
      {} as any,
    )

    expect(result).toMatchInlineSnapshot(`
      Array [
        Object {
          "data": Object {
            "name": "BOLD",
            "type": 3,
          },
          "documentation": undefined,
          "kind": 6,
          "label": "BOLD",
        },
        Object {
          "data": Object {
            "name": "my_var",
            "type": 3,
          },
          "documentation": "### Variable: **my_var** - *defined in ../comment-doc-on-hover.sh*

      \`\`\`txt
      works for variables
      \`\`\`",
          "kind": 6,
          "label": "my_var",
        },
        Object {
          "data": Object {
            "name": "my_other_var",
            "type": 3,
          },
          "documentation": "### Variable: **my_other_var** - *defined in ../comment-doc-on-hover.sh*",
          "kind": 6,
          "label": "my_other_var",
        },
        Object {
          "data": Object {
            "name": "RED",
            "type": 3,
          },
          "documentation": "### Variable: **RED** - *defined in ../extension.inc*",
          "kind": 6,
          "label": "RED",
        },
        Object {
          "data": Object {
            "name": "GREEN",
            "type": 3,
          },
          "documentation": "### Variable: **GREEN** - *defined in ../extension.inc*",
          "kind": 6,
          "label": "GREEN",
        },
        Object {
          "data": Object {
            "name": "BLUE",
            "type": 3,
          },
          "documentation": "### Variable: **BLUE** - *defined in ../extension.inc*",
          "kind": 6,
          "label": "BLUE",
        },
        Object {
          "data": Object {
            "name": "RESET",
            "type": 3,
          },
          "documentation": "### Variable: **RESET** - *defined in ../extension.inc*",
          "kind": 6,
          "label": "RESET",
        },
        Object {
          "data": Object {
            "name": "ret",
            "type": 3,
          },
          "documentation": "### Variable: **ret** - *defined in ../install.sh*",
          "kind": 6,
          "label": "ret",
        },
        Object {
          "data": Object {
            "name": "configures",
            "type": 3,
          },
          "documentation": "### Variable: **configures** - *defined in ../install.sh*

      \`\`\`txt
      See what \\"npm_config_*\\" things there are in the env,
      and make them permanent.
      If this fails, it's not such a big deal.
      \`\`\`",
          "kind": 6,
          "label": "configures",
        },
        Object {
          "data": Object {
            "name": "npm_config_loglevel",
            "type": 3,
          },
          "documentation": "### Variable: **npm_config_loglevel** - *defined in ../install.sh*",
          "kind": 6,
          "label": "npm_config_loglevel",
        },
        Object {
          "data": Object {
            "name": "node",
            "type": 3,
          },
          "documentation": "### Variable: **node** - *defined in ../install.sh*

      \`\`\`txt
      make sure that node exists
      \`\`\`",
          "kind": 6,
          "label": "node",
        },
        Object {
          "data": Object {
            "name": "TMP",
            "type": 3,
          },
          "documentation": "### Variable: **TMP** - *defined in ../install.sh*

      \`\`\`txt
      set the temp dir
      \`\`\`",
          "kind": 6,
          "label": "TMP",
        },
        Object {
          "data": Object {
            "name": "BACK",
            "type": 3,
          },
          "documentation": "### Variable: **BACK** - *defined in ../install.sh*",
          "kind": 6,
          "label": "BACK",
        },
        Object {
          "data": Object {
            "name": "tar",
            "type": 3,
          },
          "documentation": "### Variable: **tar** - *defined in ../install.sh*",
          "kind": 6,
          "label": "tar",
        },
        Object {
          "data": Object {
            "name": "MAKE",
            "type": 3,
          },
          "documentation": "### Variable: **MAKE** - *defined in ../install.sh*

      \`\`\`txt
      XXX For some reason, make is building all the docs every time.  This
      is an annoying source of bugs. Figure out why this happens.
      \`\`\`",
          "kind": 6,
          "label": "MAKE",
        },
        Object {
          "data": Object {
            "name": "make",
            "type": 3,
          },
          "documentation": "### Variable: **make** - *defined in ../install.sh*",
          "kind": 6,
          "label": "make",
        },
        Object {
          "data": Object {
            "name": "clean",
            "type": 3,
          },
          "documentation": "### Variable: **clean** - *defined in ../install.sh*",
          "kind": 6,
          "label": "clean",
        },
        Object {
          "data": Object {
            "name": "node_version",
            "type": 3,
          },
          "documentation": "### Variable: **node_version** - *defined in ../install.sh*",
          "kind": 6,
          "label": "node_version",
        },
        Object {
          "data": Object {
            "name": "t",
            "type": 3,
          },
          "documentation": "### Variable: **t** - *defined in ../install.sh*",
          "kind": 6,
          "label": "t",
        },
        Object {
          "data": Object {
            "name": "url",
            "type": 3,
          },
          "documentation": "### Variable: **url** - *defined in ../install.sh*

      \`\`\`txt
      need to echo \\"\\" after, because Posix sed doesn't treat EOF
      as an implied end of line.
      \`\`\`",
          "kind": 6,
          "label": "url",
        },
        Object {
          "data": Object {
            "name": "ver",
            "type": 3,
          },
          "documentation": "### Variable: **ver** - *defined in ../install.sh*",
          "kind": 6,
          "label": "ver",
        },
        Object {
          "data": Object {
            "name": "isnpm10",
            "type": 3,
          },
          "documentation": "### Variable: **isnpm10** - *defined in ../install.sh*",
          "kind": 6,
          "label": "isnpm10",
        },
        Object {
          "data": Object {
            "name": "NODE",
            "type": 3,
          },
          "documentation": "### Variable: **NODE** - *defined in ../install.sh*",
          "kind": 6,
          "label": "NODE",
        },
        Object {
          "data": Object {
            "name": "USER",
            "type": 3,
          },
          "documentation": "### Variable: **USER** - *defined in ../issue101.sh*",
          "kind": 6,
          "label": "USER",
        },
        Object {
          "data": Object {
            "name": "PASSWORD",
            "type": 3,
          },
          "documentation": "### Variable: **PASSWORD** - *defined in ../issue101.sh*",
          "kind": 6,
          "label": "PASSWORD",
        },
        Object {
          "data": Object {
            "name": "COMMENTS",
            "type": 3,
          },
          "documentation": "### Variable: **COMMENTS** - *defined in ../issue101.sh*

      \`\`\`txt
      Having shifted twice, the rest is now comments ...
      \`\`\`",
          "kind": 6,
          "label": "COMMENTS",
        },
        Object {
          "data": Object {
            "name": "FOO",
            "type": 3,
          },
          "documentation": "### Variable: **FOO** - *defined in ../issue206.sh*",
          "kind": 6,
          "label": "FOO",
        },
        Object {
          "data": Object {
            "name": "BAR",
            "type": 3,
          },
          "documentation": "### Variable: **BAR** - *defined in ../issue206.sh*",
          "kind": 6,
          "label": "BAR",
        },
        Object {
          "data": Object {
            "name": "PATH_INPUT",
            "type": 3,
          },
          "documentation": "### Variable: **PATH_INPUT** - *defined in ../missing-node.sh*",
          "kind": 6,
          "label": "PATH_INPUT",
        },
        Object {
          "data": Object {
            "name": "PATH_OUTPUT",
            "type": 3,
          },
          "documentation": "### Variable: **PATH_OUTPUT** - *defined in ../missing-node.sh*",
          "kind": 6,
          "label": "PATH_OUTPUT",
        },
        Object {
          "data": Object {
            "name": "foo",
            "type": 3,
          },
          "documentation": "### Variable: **foo** - *defined in ../shellcheck/sourced.sh*

      \`\`\`txt
      !/bin/bash
      \`\`\`",
          "kind": 6,
          "label": "foo",
        },
      ]
    `)
  })
})
