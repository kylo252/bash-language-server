import ShellScript, { Parser } from 'mvdan-sh'

export async function initializeParser(): Promise<Parser> {
  const ShellScript = require('mvdan-sh')
  return ShellScript.syntax.NewParser()
}
