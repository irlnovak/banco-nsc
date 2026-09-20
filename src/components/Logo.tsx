import logo from '../assets/logo.png';

export default function Logo({ height = 46 }: { height?: number }) {
  return <img src={logo} alt="Banco Nossa Senhora da Conceição" style={{ height }} />;
}
