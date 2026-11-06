let canvas;
let inputBox;
let context;

let inputBoxXDirection = 1;
let inputBoxYDirection = 1;

let textArray = [];
let textCoordinates = [];
let textDirections = [];


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

    inputBox.addEventListener('keydown',function(event){
        if(event.key === 'Enter'){
            console.log("inputBox.value: ", inputBox.value);
            textArray.push(inputBox.value);
            textCoordinates.push({x: parseInt(inputBox.style.left)+ inputBox.offsetWidth/2, y: parseInt(inputBox.style.top)+ inputBox.offsetHeight/2});
            textDirections.push({x: -inputBoxXDirection, y: -inputBoxYDirection});
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
        textCoordinates[i].x += 5 * textDirections[i].x;
        textCoordinates[i].y += 5 * textDirections[i].y;
    }
    
    requestAnimationFrame(animate);
}

init();
animate();