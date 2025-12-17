// src/navigation/navigationRef.ts
import {
  createNavigationContainerRef,
  StackActions,
} from "@react-navigation/native";


export const navigationRef = createNavigationContainerRef();


export function nav(name: string, params?: object) {
  if (navigationRef.isReady()) {
    (navigationRef.navigate as any)(name, params);
  }
}

export function replace(name: string, params?: object) {
  if (navigationRef.isReady()) {
    if (params) {
      navigationRef.dispatch(
        StackActions.replace(name as never, params as never)
      );
    } else {
      navigationRef.dispatch(StackActions.replace(name as never));
    }
  }
}

export function goBack() {
  if (navigationRef.isReady() && navigationRef.canGoBack()) {
    navigationRef.goBack();
  }
}
