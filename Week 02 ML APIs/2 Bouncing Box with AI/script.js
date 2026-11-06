let canvas;
let inputBox;
let context;

let inputBoxXDirection = 1;
let inputBoxYDirection = 1;

let textArray = [];
let textCoordinates = [];
let textDirections = [];
let textSpeeds = [];
let textAnxieties = [];

const ENDPOINT ="https://itp-ima-replicate-proxy.web.app/api/create_n_get";
const MODEL = "google/gemini-3.1-pro";


function init(){
    // creating elements
    inputBox = document.createElement('input');
    canvas = document.createElement('canvas');

    document.body.append(inputBox);
    document.body.append(canvas); //appendChild is the legacy way of doing this, append is the new way

    // styling elements/setting attributes
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    context = canvas.getContext('2d');
    context.fillStyle = '#b4cfbb';
    context.fillRect(0, 0, canvas.width, canvas.height);

    //input box event listener
    inputBox.setAttribute('type', 'text');
    inputBox.setAttribute('id', 'inputBox');
    inputBox.setAttribute('placeholder', 'Enter text here');
    inputBox.style.left = canvas.width/2 + 'px';
    inputBox.style.top = canvas.height/2 + 'px';
    inputBox.style.position = 'absolute';

    inputBox.addEventListener('keydown',async function(event){
        if(event.key === 'Enter'){
            console.log("inputBox.value: ", inputBox.value);
            let [queryText,parsedResponse] = await askLLM(inputBox.value);

            // if the response is null, set speed to 0 and axiety to 0.5
            if (parsedResponse.speed === null){
                parsedResponse.speed = 0;
            }if (parsedResponse.anxiety === null){
                parsedResponse.anxiety = 0.5;
            }

            textArray.push(queryText); // push the query original text in case the user modified the input box while waiting for the LLM response
            textCoordinates.push({x: parseInt(inputBox.style.left)+ inputBox.offsetWidth/2, y: parseInt(inputBox.style.top)+ inputBox.offsetHeight/2});
            textDirections.push({x: -inputBoxXDirection, y: -inputBoxYDirection});
            textSpeeds.push(parsedResponse.speed);
            textAnxieties.push(parsedResponse.anxiety);
        }
    })

    document.body.addEventListener('mousedown',function(event){
      inputBox.style.left = event.clientX + 'px';
      inputBox.style.top = event.clientY + 'px';  
    })


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
    context.fillStyle = '#b4cfbb';
    context.fillRect(0, 0, canvas.width, canvas.height);

    // draw on the canvas
    for (let i =0;i < textArray.length;i++){
        let textX = textCoordinates[i].x;
        let textY = textCoordinates[i].y;
        let textDirectionX = textDirections[i].x;
        let textDirectionY = textDirections[i].y;


        // write text on the canvas
        context.fillStyle = 'black';
        context.font = '20px Arial';
        context.fillText(textArray[i], textX, textY);

        //update text coordinates
        if (textX > canvas.width || textX < 0) {
            textDirections[i].x = -textDirectionX;
        }
        if (textY > canvas.height || textY < 0) {
            textDirections[i].y = -textDirectionY;
        }
        textCoordinates[i].x += textSpeeds[i] * textDirections[i].x + textAnxieties[i] * 3 * (Math.random() - 0.5);
        textCoordinates[i].y += textSpeeds[i] * textDirections[i].y + textAnxieties[i] * 3 * (Math.random() - 0.5);
    }
    
    requestAnimationFrame(animate);
}

async function askLLM(text){
    const prompt =`
    Evaluate the user input text, and determine how this word is related to speed(fast vs slow) and anxiety(calm vs nervous). Return a JSON obejct with two properties. Do not include any extra words or punctuation. The JSON object should look like this:
    {
        "speed": <on a scale of 1-5, where 1 is slow and 5 is fast>,
        "anxiety": <on a scale of 1-5, where 1 is calm and 5 is nervous>
    }
    if the input is not related to speed or anxiety, return null for both properties.
    User input: ${text}
    `
    let requestData = {
        model: MODEL,
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
            Accept: 'application/json'
        },
        body: JSON.stringify(requestData),
    }

    const raw_response = await fetch(ENDPOINT, payload);
    const json_response = await raw_response.json();
    let parsedResponse = JSON.parse(json_response.output.join(""));
    console.log("parsedResponse", parsedResponse);
    
    return [text,parsedResponse];


} 

init();
animate();