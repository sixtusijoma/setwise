import { router } from 'expo-router';

export function dismiss() {
  if (router.canDismiss()) router.dismiss();
  else router.replace('/');
}
