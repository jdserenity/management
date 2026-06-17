import { CHAIN_CONNECTOR_SVG, CHAIN_SVG_OFFSET } from '@/lib/tdee/chainConnector';

export default function TdeeChainConnector() {
  return (
    <div
      className="tdee-chain-connector"
      style={{ ['--tdee-chain-svg-offset' as string]: `${CHAIN_SVG_OFFSET}px` }}
      dangerouslySetInnerHTML={{ __html: CHAIN_CONNECTOR_SVG }}
    />
  );
}
