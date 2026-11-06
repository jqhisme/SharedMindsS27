let canvas;
let inputBox;
let context;

let inputBoxXDirection = 1;
let inputBoxYDirection = 1;

let allArray = [];

let mediaStream;
let mediaRecorder;
let audioContext;
let videoStream;
let webcamVideoElement;

let toggle;
let recordingTimer;

let RECORDING_DURATION = 5000; // 2 seconds

const ENDPOINT ="https://itp-ima-replicate-proxy.web.app/api/create_n_get";
const TOKEN ="eyJhbGciOiJSUzI1NiIsImtpZCI6IjkwNGIwZjkxYmU2ZWIwODY3ZGFiYmFhYjU4N2RmYzJlMzNmMDBhMjQiLCJ0eXAiOiJKV1QifQ.eyJuYW1lIjoiUWloYW4gSmlhbmciLCJwaWN0dXJlIjoiaHR0cHM6Ly9saDMuZ29vZ2xldXNlcmNvbnRlbnQuY29tL2EvQUNnOG9jSXdLM0NXVlRWRHdFRlcxQjRXb2RyTHNhTWJCNWtOYzkyZnp3dmZVOGR0UGdpMDZBPXM5Ni1jIiwiaXNzIjoiaHR0cHM6Ly9zZWN1cmV0b2tlbi5nb29nbGUuY29tL2l0cC1pbWEtcmVwbGljYXRlLXByb3h5IiwiYXVkIjoiaXRwLWltYS1yZXBsaWNhdGUtcHJveHkiLCJhdXRoX3RpbWUiOjE3NTc3MDg2OTksInVzZXJfaWQiOiJvdDNSUzRkUnRkZGVVM0dHUTBCd0tvWDltTnoxIiwic3ViIjoib3QzUlM0ZFJ0ZGRlVTNHR1EwQndLb1g5bU56MSIsImlhdCI6MTc5MzM4OTgzOCwiZXhwIjoxNzkzMzkzNDM4LCJlbWFpbCI6InFqMzUxQG55dS5lZHUiLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwiZmlyZWJhc2UiOnsiaWRlbnRpdGllcyI6eyJnb29nbGUuY29tIjpbIjExNTMyMzk3NzkzOTg4Mjk2MjM3NyJdLCJlbWFpbCI6WyJxajM1MUBueXUuZWR1Il19LCJzaWduX2luX3Byb3ZpZGVyIjoiZ29vZ2xlLmNvbSJ9fQ.CwBFIvJPAHKrHB2_2pCN6x2Z5oRLa9hkIDZ7_expHiOxBTe-XTgDa2JbpZ5Tas2CWpnvxZjdcHyFbU8E5LsXLx1rLx9qutmo--Rk-WktBjBUtJ8h_3YytMHqwkapFtOygIbvWcQlZuVu0JqM5FqcsoF2LTR98gN83KqbvKVRNDG0uG2UhchC2vaQEiRlQ4VTJerWxOqsDhf5QfGAWZVLvK-1pNOP6NF_dtPZAwSwpG1A2XMax_E87IzZbSW3wvCrX6f5pDImCze8X0pUbmdfJC5WdCOEHEMptEvbn04PCvlpxMjVUpp63cZqkzJB380vzYCYpbiD1WbeidIcj5trug";

let bodySegmentation;

function init(){
    // creating elements
    toggle = new ToggleSwitch(handleToggle);
    inputBox = toggle.element;
    canvas = document.createElement('canvas');

    document.body.append(inputBox);
    document.body.append(canvas); //appendChild is the legacy way of doing this, append is the new way

    // styling elements/setting attributes
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    context = canvas.getContext('2d');
    context.fillStyle = '#0a0a0a';
    context.fillRect(0, 0, canvas.width, canvas.height);

    //input box event listener
    inputBox.setAttribute('id', 'inputBox');
    inputBox.style.left = canvas.width/2 + 'px';
    inputBox.style.top = canvas.height/2 + 'px';
    inputBox.style.position = 'absolute';

    inputBox.addEventListener("mousedown", (event) => {
        event.stopPropagation();
    });


}

function animate(){
    // get the current position of the input box
    let inputBoxX = parseInt(inputBox.style.left);
    let inputBoxY = parseInt(inputBox.style.top);
    let inputBoxwith = inputBox.offsetWidth;
    let inputBoxHeight = inputBox.offsetHeight;

    if (inputBoxX+inputBoxwith > canvas.width || inputBoxX < 0) {
        inputBoxXDirection = -inputBoxXDirection;
    }
    if (inputBoxY+inputBoxHeight > canvas.height || inputBoxY < 0) {
        inputBoxYDirection = -inputBoxYDirection;
    }
    

    inputBox.style.left = inputBoxX + 1*inputBoxXDirection + 'px';
    inputBox.style.top = inputBoxY + 1*inputBoxYDirection + 'px';
    // clear the canvas
    context.fillStyle = '#0a0a0a';
    context.fillRect(0, 0, canvas.width, canvas.height);

    // draw on the canvas
    for (let i =0;i < allArray.length;i++){
        const item = allArray[i];
        const speed = item.speed;
        const anxiety = item.anxiety;

        // move the item
        item.textCoordinates.x += speed * item.textDirections.x + anxiety * 3 * (Math.random() - 0.5);
        item.textCoordinates.y += speed * item.textDirections.y + anxiety * 3 * (Math.random() - 0.5);

        if (item.textCoordinates.x +100 > canvas.width || item.textCoordinates.x < 0) {
            allArray[i].textDirections.x = -allArray[i].textDirections.x;
        }
        if (item.textCoordinates.y +100 > canvas.height || item.textCoordinates.y < 0) {
            allArray[i].textDirections.y = -allArray[i].textDirections.y;
        }


        // write text on the canvas
        context.fillStyle = 'white';
        context.font = '20px Arial';
        

        //show the masked face image on the canvas
        context.drawImage(item.maskedImage, item.textCoordinates.x, item.textCoordinates.y, 100, 100);
        //text align center
        context.textAlign = 'center';
        context.fillText(allArray[i].text, item.textCoordinates.x + 50, item.textCoordinates.y + 130);

        //update text coordinates
        

        // allArray[i].textCoordinates.x += textSpeed * textDirectionX + textAnxiety * 3 * (Math.random() - 0.5);
        // allArray[i].textCoordinates.y += textSpeed * textDirectionY + textAnxiety * 3 * (Math.random() - 0.5);
    }
    
    requestAnimationFrame(animate);
}

// async function askLLM(text){
//     const prompt =`
//     Evaluate the user input text, and determine how this word is related to speed(fast vs slow) and anxiety(calm vs nervous). Return a JSON obejct with two properties. Do not include any extra words or punctuation. The JSON object should look like this:
//     {
//         "speed": <on a scale of 1-5, where 1 is slow and 5 is fast>,
//         "anxiety": <on a scale of 1-5, where 1 is calm and 5 is nervous>
//     }
//     if the input is not related to speed or anxiety, return null for both properties.
//     User input: ${text}
//     `
//     let requestData = {
//         model: MODEL,
//         input: {
//             prompt: prompt,
//             thinking_level: "low",
//             temperature: 0.01, // low temperature for deterministic output
//         },
//     }

//     let payload = {
//         method: "POST",
//         headers: {
//             "Content-Type": "application/json",
//             Accept: 'application/json'
//         },
//         body: JSON.stringify(requestData),
//     }

//     const raw_response = await fetch(ENDPOINT, payload);
//     const json_response = await raw_response.json();
//     let parsedResponse = JSON.parse(json_response.output.join(""));
//     console.log("parsedResponse", parsedResponse);
    
//     return [text,parsedResponse];
// } 


function captureWebcam(){
    if (!webcamVideoElement || webcamVideoElement.readyState < 2) {
        throw new Error("Webcam is not ready yet");
    }

    const snapshot  = document.createElement('canvas');
    snapshot.width = webcamVideoElement.videoWidth;
    snapshot.height = webcamVideoElement.videoHeight;
    const ctx = snapshot.getContext('2d');
    ctx.drawImage(webcamVideoElement, 0, 0, snapshot.width, snapshot.height);
    return snapshot;
}
async function setUpAudioAndVideo() {
    audioContext = new AudioContext();
    mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });

    videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
    webcamVideoElement = document.createElement('video');
    webcamVideoElement.srcObject = videoStream;
    webcamVideoElement.playsInline = false;
    // hide the video element since we only need it for capturing frames
    webcamVideoElement.style.display = 'none';
    webcamVideoElement.muted = true;
    document.body.append(webcamVideoElement);
    await webcamVideoElement.play();
    let mrChunks = [];

    mediaRecorder = new MediaRecorder(mediaStream);

    // init body segmentation model
    bodySegmentation = await ml5.bodySegmentation("SelfieSegmentation", {maskType: "background"});

    mediaRecorder.addEventListener("start", () => {
        mrChunks = [];
    });

    mediaRecorder.addEventListener("dataavailable", (event) => {
        if (event.data.size > 0) {
            mrChunks.push(event.data);
        }
    });

    mediaRecorder.addEventListener("stop", async () => {
        clearTimeout(recordingTimer);
        toggle.uncheck();
        toggle.input.disabled = false;

        const recordedData = new Blob(mrChunks, {
            type: mediaRecorder.mimeType
        });

        mrChunks = [];

        try {
            const imageCaptured = captureWebcam();

            const result = await askAIfromVoice(
                recordedData,
                imageCaptured
            );

            console.log(result);

            if (! result.anxiety){
                result.anxiety = 2;
            }
            if (! result.speed){
                result.speed = 0;
            }

            allArray.push({
                text: result.text,
                speed: result.speed,
                anxiety: result.anxiety,
                imageCaptured: result.imageCaptured,
                maskedImage: result.maskedImage,
                textCoordinates: { x: parseInt(inputBox.style.left) + inputBox.offsetWidth / 2, y: parseInt(inputBox.style.top) + inputBox.offsetHeight / 2 },
                textDirections: { x: -inputBoxXDirection, y: -inputBoxYDirection }
            })

        } catch (error) {
            console.error("AI request failed:", error);
        }
    });

}
function convertBlobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = () => {
            resolve(reader.result.split(",")[1]);
        };

        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
    });
}

function stopRecording() {
    clearTimeout(recordingTimer);
    toggle.uncheck();

    if (mediaRecorder && mediaRecorder.state !== "inactive") {
        // Wait for the final audio chunk before allowing another recording.
        toggle.input.disabled = true;
        mediaRecorder.stop();
    }
}

async function handleToggle(isOn) {
    if (!isOn) {
        stopRecording();
        return;
    }

    // Disable only while requesting permissions and preparing the devices.
    toggle.input.disabled = true;

    try {
        if (!mediaRecorder) {
            await setUpAudioAndVideo();
        }

        mediaRecorder.start();
        toggle.input.disabled = false;
        recordingTimer = setTimeout(stopRecording, RECORDING_DURATION);
    } catch (error) {
        console.error("Could not start recording:", error);
        clearTimeout(recordingTimer);
        toggle.uncheck();
        toggle.input.disabled = false;
    }
}

async function askAIfromVoice(recordedData, imageCaptured) {
    // get the word transcribed from the audio using the proxy endpoint
    const audio = recordedData;
    const b64Audio = await convertBlobToBase64(audio);

    let data = {
        //proxy will convert this base64 audio to a url
        fieldToConvertBase64ToURL: "audio",
        fileFormat: "wav",
        version: "vaibhavs10/incredibly-fast-whisper:c6433aab18b7318bbae316495f1a097fc067deef7d59dc2f33e45077ae5956c7",
        input: {
            audio: b64Audio,
        },
    };
    let options = {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            Authorization: `Bearer `
        },
        body: JSON.stringify(data),
    };
    console.log("Converting audio to text...");

    let response = await fetch(ENDPOINT, options);
    let response_json = await response.json();
    console.log("audio_response", response_json);
    let word = response_json.output.text;
    console.log("word", word);

    // get the speed and anxiety from the word using the LLM
    const prompt =`
    Evaluate the user input text, and determine how this word is related to speed(fast vs slow) and anxiety(calm vs nervous). Return a JSON obejct with two properties. Do not include any extra words or punctuation. The JSON object should look like this:
    {
        "speed": <on a scale of 1-5, where 1 is slow and 5 is fast>,
        "anxiety": <on a scale of 1-5, where 1 is calm and 5 is nervous>
    }
    if the input is not related to speed or anxiety, return null for both properties.
    User input: ${word}
    `
    let requestData = {
        model: 'google/gemini-3.1-pro',
        input: {
            prompt: prompt,
            thinking_level: "low",
            temperature: 0.01, // low temperature for deterministic output
        },
    }

    let payload = {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Accept: 'application/json',
            Authorization: `Bearer ${TOKEN}`
        },
        body: JSON.stringify(requestData),
    }
    console.log("Asking LLM...");
    const raw_response = await fetch(ENDPOINT, payload);
    const json_response = await raw_response.json();
    let parsedResponse = JSON.parse(json_response.output.join(""));
    console.log("parsedResponse", parsedResponse);

    // segment the human face from the image using the imageCaptured
    // const faceModel = 'schananas/grounded_sam:ee871c19efb1941f55f66a3d7d960428c8a5afcb77449547fe8e5a3ab9ebc21c';
    // let imageB64 = imageCaptured.toDataURL()
    // // strip the data URL prefix to get only the base64 string
    // imageB64 = imageB64.split(',')[1];


    // let faceRequestData = {
    //     version: faceModel,
    //     fieldToConvertBase64ToURL:'image',
    //     fileFormat:"jpg",
    //     input: {
    //         image: imageB64,
    //         mask_prompt:"person"
    //     }
    // }

    
    // let facePayload = {
    //     method: "POST",
    //     headers: {
    //         "Content-Type": "application/json",
    //         Accept: 'application/json',
    //         Authorization: `Bearer ${TOKEN}`
    //     },
    //     body: JSON.stringify(faceRequestData),
    // }

    // console.log("Segmenting face from image...");
    // const face_raw_response = await fetch(ENDPOINT, facePayload);
    // const face_json_response = await face_raw_response.json();
    // console.log("face_json_response", face_json_response);
    // const face_mask_b64 = face_json_response.output[2];

    // // create an image from imageCaptured masked with the face mask
    // let mask = new Image();
    // mask.src = face_mask_b64;
    // mask.onload = () => {
    //     context.drawImage(mask, 0, 0, canvas.width, canvas.height);
    // };
    let maskedImage;
    await bodySegmentation.detect(imageCaptured,(result)=>{
        mask = result.mask; //ImageData

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = imageCaptured.width;
        tempCanvas.height = imageCaptured.height;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.putImageData(result.mask, 0, 0);

        maskedImage = document.createElement("canvas");
        maskedImage.width = imageCaptured.width;
        maskedImage.height = imageCaptured.height;
        const ctx = maskedImage.getContext("2d");
        ctx.drawImage(imageCaptured, 0, 0);
        ctx.globalCompositeOperation = "destination-in";
        ctx.drawImage(
            tempCanvas,
            0,
            0,
            maskedImage.width,
            maskedImage.height
        )
        ctx.globalCompositeOperation = "source-over";

    });


    return {
        text: word,
        speed: parsedResponse.speed,
        anxiety: parsedResponse.anxiety,
        imageCaptured: imageCaptured,
        maskedImage: maskedImage
    }
    
}

class ToggleSwitch{
    constructor(onChange = ()=>{}) {
        this.element = document.createElement('label');
        this.element.className = 'toggle-switch';

        this.input = document.createElement('input');
        this.input.type = 'checkbox';
        this.input.checked = false;

        const slider = document.createElement('span');
        slider.className = 'slider round';
        this.element.append(this.input, slider);

        const knob = document.createElement("span");
        slider.append(knob);


        this.input.addEventListener('change',()=>{
            this.updateAppearance();
            onChange(this.input.checked);
        });

        // styling the toggle switch
        Object.assign(this.element.style, {
        position: "relative",
        display: "inline-block",
        width: "60px",
        height: "34px",
        });

        Object.assign(this.input.style, {
        opacity: "0",
        width: "0",
        height: "0",
        });

        Object.assign(slider.style, {
        position: "absolute",
        inset: "0",
        cursor: "pointer",
        backgroundColor: "#ccc",
        borderRadius: "34px",
        transition: "background-color 0.3s",
        });

        
        Object.assign(knob.style, {
            position: "absolute",
            width: "26px",
            height: "26px",
            left: "4px",
            top: "4px",
            borderRadius: "50%",
            backgroundColor: "white",
            transition: "transform 0.3s"
        });

        this.updateAppearance = () => {
            slider.style.backgroundColor =
                this.input.checked ? "#2196f3" : "#ccc";

            knob.style.transform =
                this.input.checked ? "translateX(26px)" : "translateX(0)";
        };
        this.updateAppearance();

    }

    check(){
        this.input.checked = true;
        this.updateAppearance();
    }
    uncheck(){
        this.input.checked = false;
        this.updateAppearance();
    }
}

init();
animate();