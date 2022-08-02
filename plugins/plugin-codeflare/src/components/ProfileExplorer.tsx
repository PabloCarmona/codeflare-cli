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

import React from "react"
import prettyMillis from "pretty-ms"
import { EventEmitter } from "events"
import { Profiles } from "madwizard"
import { Loading } from "@kui-shell/plugin-client-common"
import {
  Card,
  CardTitle,
  CardBody,
  Title,
  Button,
  Flex,
  FlexItem,
  Select,
  SelectOption,
  SelectVariant,
  SelectOptionObject,
  CardFooter,
  DescriptionList,
  DescriptionListGroup,
  DescriptionListTerm,
  DescriptionListDescription,
} from "@patternfly/react-core"

import ProfileWatcher from "../tray/watchers/profile/list"
import "../../web/scss/components/ProfileExplorer/_index.scss"
import "../../web/scss/components/Dashboard/Description.scss"

import { UserIcon } from "@patternfly/react-icons"

const events = new EventEmitter()

function emitSelectProfile(profile: string) {
  events.emit("/profile/select", profile)
}

export function onSelectProfile(cb: (profile: string) => void) {
  events.on("/profile/select", cb)
}

export function offSelectProfile(cb: (profile: string) => void) {
  events.off("/profile/select", cb)
}

type Props = Record<string, never>

type State = {
  watcher: ProfileWatcher
  selectedProfile?: string
  profiles?: Profiles.Profile[]
  catastrophicError?: unknown
  selectIsOpen: boolean
  selectDefaultOption?: string | SelectOptionObject
  dashboardSelectIsOpen: boolean
}

export default class ProfileExplorer extends React.PureComponent<Props, State> {
  public constructor(props: Props) {
    super(props)
    this.init()
    this.selectOnToggle = this.selectOnToggle.bind(this)
    this.selectOnSelect = this.selectOnSelect.bind(this)
    this.dashboardSelectOnToggle = this.dashboardSelectOnToggle.bind(this)
    this.dashboardSelectOnSelect = this.dashboardSelectOnSelect.bind(this)
    this.handleBoot = this.handleBoot.bind(this)
    this.handleShutdown = this.handleShutdown.bind(this)
  }

  private updateDebouncer: null | ReturnType<typeof setTimeout> = null

  private readonly updateFn = () => {
    if (this.updateDebouncer) {
      clearTimeout(this.updateDebouncer)
    }

    // hmm, this is imperfect... the watcher seems to give us [A],
    // then [A,B], then [A,B,C] in quick succession. is there any way
    // to know that we are done with the initial batch? for now, we do
    // some debouncing.
    this.updateDebouncer = setTimeout(() => {
      this.setState((curState) => {
        if (JSON.stringify(curState.watcher.profiles) === JSON.stringify(curState.profiles)) {
          return null
        }

        const profiles = curState.watcher.profiles.slice()

        let selectedProfile = curState.selectedProfile
        if (!curState || !curState.profiles || curState.profiles.length === 0) {
          // sort the first time we get a list of profiles; TODO should
          // we re-sort if the list changes? what we want to avoid is
          // resorting simply because the selection changed
          profiles.sort((a, b) => b.lastUsedTime - a.lastUsedTime)

          // also emit an initial profile selection event
          selectedProfile = profiles[0].name
          emitSelectProfile(selectedProfile)
        }

        return {
          profiles,
          selectedProfile,
        }
      })
    }, 100)
  }

  private async init() {
    try {
      const watcher = await new ProfileWatcher(this.updateFn, await Profiles.profilesPath({}, true)).init()
      this.setState({
        watcher,
        profiles: [],
        selectIsOpen: false,
      })
    } catch (err) {
      console.error(err)
      this.setState({ catastrophicError: err })
    }
  }

  public componentWillUnmount() {
    if (this.state && this.state.watcher) {
      this.state.watcher.close()
    }
  }

  /** User has clicked to select a profile */
  private readonly onSelect = async (evt: React.MouseEvent<HTMLElement>) => {
    const selectedProfile = evt.currentTarget.getAttribute("data-profile")
    evt.currentTarget.scrollIntoView(true)
    if (selectedProfile && selectedProfile !== this.state.selectedProfile) {
      if (await Profiles.bumpLastUsedTime(selectedProfile)) {
        emitSelectProfile(selectedProfile)
        this.setState({ selectedProfile })
      }
    }
  }

  private prettyMillis(duration: number) {
    if (duration < 1000) {
      return "just now"
    } else {
      return prettyMillis(duration, { compact: true }) + " ago"
    }
  }

  selectOnToggle(selectIsOpen: boolean) {
    this.setState({ selectIsOpen })
  }

  selectOnSelect(
    event: React.ChangeEvent<Element> | React.MouseEvent<Element>,
    selection: string | SelectOptionObject,
    isPlaceholder?: boolean | undefined
  ) {
    if (isPlaceholder) {
      this.clearSelection()
    } else {
      this.setState({
        selectDefaultOption: selection,
        selectIsOpen: false,
      })
    }
  }

  clearSelection() {
    this.setState({
      selectDefaultOption: undefined,
      selectIsOpen: false,
    })
  }

  dashboardSelectOnToggle(dashboardSelectIsOpen: boolean) {
    this.setState({ dashboardSelectIsOpen })
  }

  async dashboardSelectOnSelect(
    event: React.ChangeEvent<Element> | React.MouseEvent<Element>,
    selection: string | SelectOptionObject,
    isPlaceholder?: boolean | undefined
  ) {
    if (isPlaceholder) {
      this.setState({ dashboardSelectIsOpen: false })
    } else {
      this.openWindow(`Codeflare Run Summary - ${this.state.selectedProfile}`, "Codeflare Run Summary", [
        "codeflare",
        "get",
        "run",
        "--profile",
        this.state.selectedProfile,
      ])
      this.setState({ dashboardSelectIsOpen: false })
    }
  }

  async openWindow(title: string, initialTabTitle: string, argv: (string | undefined)[]) {
    const { ipcRenderer } = await import("electron")

    ipcRenderer.send(
      "synchronous-message",
      JSON.stringify({
        operation: "new-window",
        title,
        initialTabTitle,
        width: 1200,
        height: 800,
        argv,
      })
    )
  }

  handleBoot() {
    this.openWindow(`Booting ${this.state.selectedProfile}`, "Booting", [
      "codeflare",
      "gui",
      "guide",
      "-y",
      "--profile",
      this.state.selectedProfile,
      "ml/ray/start/kubernetes",
    ])
  }

  handleShutdown() {
    this.openWindow(`Shutting down ${this.state.selectedProfile}`, "Shutting down", [
      "codeflare",
      "gui",
      "guide",
      "-y",
      "--profile",
      this.state.selectedProfile,
      "ml/ray/stop",
    ])
  }

  public render() {
    if (this.state && this.state.catastrophicError) {
      return "Internal Error"
    } else if (!this.state || !this.state.profiles) {
      return <Loading />
    } else {
      return (
        <Flex className="codeflare--profile-explorer flex-fill" direction={{ default: "column" }}>
          <FlexItem>
            <Select
              toggleIcon={<UserIcon />}
              variant={SelectVariant.single}
              placeholderText="Select a profile"
              aria-label="Profiles selector with description"
              onToggle={this.selectOnToggle}
              onSelect={this.selectOnSelect}
              selections={this.state.selectedProfile}
              isOpen={this.state.selectIsOpen}
              aria-labelledby="select-profile-label"
            >
              {this.state.profiles.map((profile, index) => (
                <SelectOption
                  key={index}
                  value={profile.name}
                  description={`Last used ${this.prettyMillis(Date.now() - profile.lastUsedTime)}`}
                />
              ))}
            </Select>
          </FlexItem>

          <FlexItem>
            <Card>
              <CardTitle>
                <Flex>
                  <FlexItem flex={{ default: "flex_1" }}>
                    <Title headingLevel="h2" size="md">
                      {this.state.selectedProfile}
                    </Title>
                  </FlexItem>
                  <FlexItem>
                    <Title headingLevel="h2" size="md">
                      Status: pending
                    </Title>
                  </FlexItem>
                </Flex>
              </CardTitle>
              <CardBody>
                <DescriptionList className="codeflare--profile-explorer--description">
                  <DescriptionListGroup className="codeflare--profile-explorer--description--group">
                    <DescriptionListTerm>Cluster Context</DescriptionListTerm>
                    <DescriptionListDescription>
                      api-codeflare-train-v11-codeflare-openshift-com
                    </DescriptionListDescription>
                  </DescriptionListGroup>
                  <DescriptionListGroup className="codeflare--profile-explorer--description--group">
                    <DescriptionListTerm>Cluster Namespace</DescriptionListTerm>
                    <DescriptionListDescription>nvidia-gpu-operator</DescriptionListDescription>
                  </DescriptionListGroup>
                  <DescriptionListGroup className="codeflare--profile-explorer--description--group">
                    <DescriptionListTerm>Memory per Worker</DescriptionListTerm>
                    <DescriptionListDescription>32Gi</DescriptionListDescription>
                  </DescriptionListGroup>
                  <DescriptionListGroup className="codeflare--profile-explorer--description--group">
                    <DescriptionListTerm>Worker Count</DescriptionListTerm>
                    <DescriptionListDescription>4-4</DescriptionListDescription>
                  </DescriptionListGroup>
                </DescriptionList>
              </CardBody>
              <CardFooter>
                <Flex>
                  <FlexItem>
                    <Button
                      variant="primary"
                      className="codeflare--profile-explorer--boot-btn"
                      onClick={this.handleBoot}
                    >
                      Boot
                    </Button>
                  </FlexItem>
                  <FlexItem>
                    <Button
                      variant="secondary"
                      className="codeflare--profile-explorer--shutdown-btn"
                      onClick={this.handleShutdown}
                    >
                      Shutdown
                    </Button>
                  </FlexItem>
                  <FlexItem>
                    <Select
                      variant={SelectVariant.single}
                      placeholderText="Dashboards"
                      aria-label="Dashboards selector"
                      onToggle={this.dashboardSelectOnToggle}
                      onSelect={this.dashboardSelectOnSelect}
                      isOpen={this.state.dashboardSelectIsOpen}
                      aria-labelledby="select-dashboard-label"
                    >
                      <SelectOption value="CodeFlare" />
                      <SelectOption value="MLFlow" isPlaceholder />
                      <SelectOption value="Tensorboard" isPlaceholder />
                    </Select>
                  </FlexItem>
                </Flex>
              </CardFooter>
            </Card>
          </FlexItem>
        </Flex>
      )
    }
  }
}
