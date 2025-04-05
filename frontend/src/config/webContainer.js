// For running the code in the browser we use Web Containers refer webcontainer.io website
import { WebContainer } from '@webcontainer/api';

let webContainerInstance = null;


export const getWebContainer = async () => {
    
    if ( webContainerInstance === null ) {
        webContainerInstance = await WebContainer.boot();
    }

    return webContainerInstance;
};