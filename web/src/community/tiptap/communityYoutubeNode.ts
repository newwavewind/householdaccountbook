import { Node, mergeAttributes } from '@tiptap/core'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    communityYoutube: {
      insertCommunityYoutube: (videoId: string) => ReturnType
    }
  }
}

export const CommunityYoutubeNode = Node.create({
  name: 'communityYoutube',
  group: 'block',
  atom: true,
  addAttributes() {
    return {
      videoId: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-video-id'),
        renderHTML: (attrs) => {
          if (!attrs.videoId) return {}
          return { 'data-video-id': attrs.videoId as string }
        },
      },
    }
  },
  parseHTML() {
    return [{ tag: 'div[data-community-youtube]' }]
  },
  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-community-youtube': '',
        class: 'community-youtube-embed',
        contenteditable: 'false',
      }),
    ]
  },
  addCommands() {
    return {
      insertCommunityYoutube:
        (videoId: string) =>
        ({ chain }) =>
          chain()
            .insertContent({
              type: this.name,
              attrs: { videoId },
            })
            .run(),
    }
  },
})
