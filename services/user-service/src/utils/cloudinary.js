import  {v2 as cloudinary} from 'cloudinary';
import logger from '../utils/logger.js'


cloudinary.config({ 
    cloud_name:'dviujdzme', 
    api_key:337159456378228,
    api_secret:'wnOyKnxb1XYYhZLm7v5IrjsRb7s' 
});
  


const uploadonCloudinay = async (file)=>{
    
  return new Promise((resolve,reject)=>{
    const uploadStream = cloudinary.uploader.upload_stream({
        resourse_type : "auto"
    },
    (error, result)=>{
        if(error){
            logger.error("Error while uploading image to cloudinary..",error)

            reject(error);
        } else{
        resolve(result);
    }
    }
)
      uploadStream.end(file.buffer);
  });
}

export {uploadonCloudinay};

