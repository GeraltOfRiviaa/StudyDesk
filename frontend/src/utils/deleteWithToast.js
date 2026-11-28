import { toast } from "@/lib/toast";
import { deleteItem } from "@/api/deleteItem";


export const deleteWithToast = async (type, id, { signal, modalSignal } = {}) =>{
    try{
        await deleteItem({ type, id }, { signal })
        if (!modalSignal?.aborted) toast.add({
                title: `${type} deleted`,
                type: "success",
            });
    }
    catch (err){
        if (!modalSignal?.aborted) toast.add({
                title: `Could not delete ${type}`,
                description: "Try again later",
                type: "error",
            });
        throw err
    }
}
