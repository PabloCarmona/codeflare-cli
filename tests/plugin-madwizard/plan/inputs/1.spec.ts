/*
 * Copyright 2022 The Kubernetes Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import doPlan from "../plan"
import Input, { Tree } from "../Input"

const importa: (name?: string) => Tree = (name = "importa.md") => ({ name, children: [{ name: "echo AAA" }] })

const importc: Tree = { name: "importc.md", children: [{ name: "echo CCC" }] }

// const option2Tab2: Tree = { name: 'Option 2: Tab2', children: [importc] }

const importe: Tree = { name: "EEE", children: [{ name: "Option 1: TabE1", children: [{ name: "echo EEE" }] }] }

const importd: Tree = {
  name: "DDD",
  children: [
    { name: "Option 1: SubTab1", children: [{ name: "echo AAA" }, { name: "echo AAA" }, { name: "echo AAA" }] },
    { name: "Option 2: SubTab2", children: [{ name: "echo BBB" }] },
  ],
}

const prerequisites = {
  name: "Prerequisites",
  children: [importe, importd],
}

const IN1: Input = {
  input: "guidebook-tree-model1.md",
  tree: () => [prerequisites],
}

export { importa, importc, importe, importd }

doPlan(IN1)
