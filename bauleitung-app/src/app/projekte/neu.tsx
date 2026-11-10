import { router } from 'expo-router';
import { ProjektFormular } from '../../ui/ProjektFormular';
import { Titel } from '../../ui/Rahmen';

export default function NeuesProjektScreen() {
  return (
    <>
      <Titel text="Neues Projekt" />
      <ProjektFormular onFertig={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
    </>
  );
}
