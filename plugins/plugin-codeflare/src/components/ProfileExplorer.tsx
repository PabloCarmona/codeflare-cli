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
  Grid,
  GridItem,
  Card,
  CardTitle,
  CardBody,
  CardFooter,
  Divider,
  Title,
  Button,
  Flex,
  FlexItem,
} from "@patternfly/react-core"

import ProfileWatcher from "../tray/watchers/profile/list"

import { OutlinedClockIcon, UserPlusIcon, PlayIcon, PowerOffIcon } from "@patternfly/react-icons"
// import ProfileIcon from "@patternfly/react-icons/dist/esm/icons/user-icon"

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
}

export default class ProfileExplorer extends React.PureComponent<Props, State> {
  public constructor(props: Props) {
    super(props)
    this.init()
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

  public render() {
    if (this.state && this.state.catastrophicError) {
      return "Internal Error"
    } else if (!this.state || !this.state.profiles) {
      return <Loading />
    } else {
      return (
        <Grid className="codeflare--gallery-grid flex-fill sans-serif top-pad left-pad right-pad bottom-pad" hasGutter>
          {this.state.profiles.map((_) => (
            <GridItem key={_.name}>
              <Card isSelectableRaised>
                <CardTitle>
                  <Title headingLevel="h2" size="lg">
                    {_.name}
                  </Title>
                </CardTitle>
                <CardBody>
                  <Flex flexWrap={{ default: "nowrap" }}>
                    <FlexItem>
                      <OutlinedClockIcon aria-hidden="true" />
                    </FlexItem>
                    <FlexItem>
                      <span>{`Last used ${this.prettyMillis(Date.now() - _.lastUsedTime)}`}</span>
                    </FlexItem>
                  </Flex>
                </CardBody>
                <Divider />
                <CardFooter>
                  <Flex flexWrap={{ default: "nowrap" }}>
                    <FlexItem>
                      <Button variant="link">
                        <PlayIcon aria-hidden="true" />
                      </Button>
                    </FlexItem>
                    <FlexItem>
                      <Button variant="link">
                        <PowerOffIcon aria-hidden="true" />
                      </Button>
                    </FlexItem>
                  </Flex>
                </CardFooter>
              </Card>
            </GridItem>
          ))}

          {
            <GridItem>
              <Card isSelectableRaised isDisabledRaised>
                <CardTitle>
                  <Title headingLevel="h2" size="lg">
                    <Flex flexWrap={{ default: "nowrap" }}>
                      <FlexItem>
                        <UserPlusIcon aria-hidden="true" />
                      </FlexItem>
                      <FlexItem>
                        <span>New Profile</span>
                      </FlexItem>
                    </Flex>
                  </Title>
                </CardTitle>
                <CardBody>Customize a profile</CardBody>
              </Card>
            </GridItem>
          }
        </Grid>
      )
    }
  }
}
