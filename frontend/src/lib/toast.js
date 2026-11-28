import { Toast } from "@base-ui/react/toast"

// Share one manager between mutation callbacks and the mounted Toaster.
export const toast = Toast.createToastManager()
