import type {TestCompositionProps} from '@ai-video-studio/schema';
import type {FC} from 'react';

export const TestComposition: FC<TestCompositionProps> = ({title, theme}) => {
  return (
    <main
      style={{
        alignItems: 'center',
        backgroundColor: theme.colors.background,
        color: theme.colors.foreground,
        display: 'flex',
        fontFamily: theme.fonts.body,
        height: '100%',
        justifyContent: 'center',
        width: '100%',
      }}
    >
      <h1>{title}</h1>
    </main>
  );
};
