declare module 'react-native-markdown-display' {
  import { Component } from 'react';
  import { TextStyle, ViewStyle } from 'react-native';

  export interface MarkdownStyles {
    body?: TextStyle;
    heading1?: TextStyle;
    heading2?: TextStyle;
    heading3?: TextStyle;
    heading4?: TextStyle;
    heading5?: TextStyle;
    heading6?: TextStyle;
    hr?: ViewStyle;
    strong?: TextStyle;
    em?: TextStyle;
    s?: TextStyle;
    blockquote?: ViewStyle;
    bullet_list?: ViewStyle;
    ordered_list?: ViewStyle;
    list_item?: ViewStyle;
    code_inline?: TextStyle;
    code_block?: ViewStyle;
    fence?: ViewStyle;
    table?: ViewStyle;
    thead?: ViewStyle;
    tbody?: ViewStyle;
    th?: TextStyle;
    tr?: ViewStyle;
    td?: TextStyle;
    link?: TextStyle;
    blocklink?: ViewStyle;
    image?: ViewStyle;
    text?: TextStyle;
    textgroup?: TextStyle;
    paragraph?: TextStyle;
    hardbreak?: TextStyle;
    softbreak?: TextStyle;
    pre?: TextStyle;
    inline?: TextStyle;
    span?: TextStyle;
  }

  export interface MarkdownProps {
    children: string;
    style?: MarkdownStyles;
    mergeStyle?: boolean;
    onLinkPress?: (url: string) => boolean | void;
  }

  export default class Markdown extends Component<MarkdownProps> {}
}

