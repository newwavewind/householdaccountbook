import { Extension } from '@tiptap/core'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    textColor: {
      setColor: (color: string) => ReturnType
      unsetColor: () => ReturnType
    }
  }
}

/** TextStyle 마크에 color (글자색) */
export const CommunityTextColor = Extension.create({
  name: 'textColor',
  addOptions() {
    return { types: ['textStyle'] }
  },
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          color: {
            default: null,
            parseHTML: (element) => {
              const raw = element.style.color
              return raw && raw.length > 0 ? raw : null
            },
            renderHTML: (attributes) => {
              if (!attributes.color) return {}
              return { style: `color: ${attributes.color}` }
            },
          },
        },
      },
    ]
  },
  addCommands() {
    return {
      setColor:
        (color: string) =>
        ({ chain }) =>
          chain().setMark('textStyle', { color }).run(),
      unsetColor:
        () =>
        ({ chain }) =>
          chain().setMark('textStyle', { color: null }).removeEmptyTextStyle().run(),
    }
  },
})
