import multer from "multer";


const uploadImage = multer({
    storage: multer.memoryStorage(),
    limits:{ 
        fileSize: 5 * 1024 * 1024
    }

}).single('profileImage');



export default uploadImage;