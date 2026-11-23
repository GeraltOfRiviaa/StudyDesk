import { toast } from "../ui/toast";
import { deleteItem } from "@/components/api/deteleItem";


export const deleteWithToast = async (type, id) =>{
    try{
        await deleteItem({ type: type, id: id })
        toast.add({
                title: `${type} deleted`,
                type: "success",
            });
    }
    catch (err){
        toast.add({
                title: `Could not delete ${type}`,
                description: "Try again later",
                type: "error",
            });
        throw err
    }
}