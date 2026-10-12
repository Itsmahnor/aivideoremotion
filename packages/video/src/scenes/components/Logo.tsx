import {useState, type FC} from 'react';
import {Img} from 'remotion';
import {textMetrics} from '../../tokens';
import {resolveAsset} from '../assets';
import {useSceneKit} from '../kit';

/** Brand logo. Falls back to a text wordmark if the logo is missing or fails to load. */
export const Logo: FC<{height: number}> = ({height}) => {
  const {brand} = useSceneKit();
  const [failed, setFailed] = useState(false);

  if (!brand.logoUrl || failed) {
    return (
      <div
        style={{
          alignItems: 'center',
          color: brand.colors.text,
          display: 'flex',
          fontFamily: brand.fonts.heading,
          fontSize: height * 0.7,
          fontWeight: textMetrics.fontWeight.bold,
          gap: height * 0.25,
          lineHeight: 1,
        }}
      >
        <span style={{backgroundColor: brand.colors.primary, borderRadius: height * 0.3, display: 'inline-block', height: height * 0.7, width: height * 0.7}} />
        {brand.name}
      </div>
    );
  }
  return <Img src={resolveAsset(brand.logoUrl)} onError={() => setFailed(true)} style={{display: 'block', height, objectFit: 'contain', width: 'auto'}} />;
};
