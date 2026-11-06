import { router } from 'expo-router';
import { ProjektFormular } from '../../ui/ProjektFormular';

export default function NeuesProjektScreen() {
  return <ProjektFormular onFertig={() => (router.canGoBack() ? router.back() : router.replace('/'))} />;
}
