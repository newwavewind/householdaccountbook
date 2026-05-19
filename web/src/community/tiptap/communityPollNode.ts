import { Node, mergeAttributes } from '@tiptap/core'
import { parsePollData, serializePollData, type CommunityPollData } from '../communityPollTypes'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    communityPoll: {
      insertCommunityPoll: (data: CommunityPollData) => ReturnType
    }
  }
}

export const CommunityPollNode = Node.create({
  name: 'communityPoll',
  group: 'block',
  atom: true,
  addAttributes() {
    return {
      pollData: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-poll'),
        renderHTML: (attrs) => {
          if (!attrs.pollData) return {}
          return { 'data-poll': attrs.pollData as string }
        },
      },
    }
  },
  parseHTML() {
    return [{ tag: 'div[data-community-poll]' }]
  },
  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-community-poll': '',
        class: 'community-poll-embed',
        contenteditable: 'false',
      }),
    ]
  },
  addCommands() {
    return {
      insertCommunityPoll:
        (data: CommunityPollData) =>
        ({ chain }) =>
          chain()
            .insertContent({
              type: this.name,
              attrs: { pollData: serializePollData(data) },
            })
            .run(),
    }
  },
})

export function pollPreviewLabel(pollDataAttr: string | null): string {
  const p = parsePollData(pollDataAttr)
  if (!p) return '투표'
  return `투표: ${p.question}`
}
