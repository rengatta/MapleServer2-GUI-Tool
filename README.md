# MinecraftServer2 GUI Tool
Currently just acts as an item viewer and item spawner for usage with MapleServer2 (https://github.com/AlanMorel/MapleServer2)

## Setup Instructions:

### Extract Icons/Xmls
1. Get Orion2 Repacker (https://github.com/angelotadeucci/Orion2-Repacker)
2. Export Image.m2d and Xml.m2d from your favorite Minecraft client
3. Find itemname.xml (probably in Xml/string/en/)
4. Go to paths.json
5. Replace the corresponding strings with global paths to /Xml/item, /Image and /itemname.xml
6. Close the repacker tool before launching the client

### Node/Electron
1. Download nodejs (https://nodejs.org/en/download/)
2. Open a commandline interface
3. cd to the project folder
4. Type ```npm install```

### API (Optional)
If you aren't connected to an API server, the buttons will just copy a command to your clipboard.
Otherwise, you can mod an API into your MapleServer2 project that will put items directly into your inventory without having to paste.
1. Add RabbitApi.cs somewhere inside MapleServer2 in the project explorer.
2. Find ResponseKeyHandler.cs
3. Add the line ```RabbitApi.AdminApiServer.AddSession(player.CharacterId, session);``` somewhere within the end of the function => Handle(GameSession session, PacketReader packet)
![image](https://user-images.githubusercontent.com/53513566/136861651-1aa58f51-ea1b-43a1-9817-82b504f688b2.png)

## Usage:
1. Open a commandline interface
2. cd to the project folder
3. Type ```npm start```
4. Click an item to copy the corresponding item command to your clipboard if not connected to the API server
5. Search by itemname/id or by tags
6. List of tags is outputted to the developer console

### API Usage:
1. Start the MapleServer2 project as usual after applying the API file and line
2. Login and join the game as any character
3. Scroll up in the server console and find the ```[API] GameSession started => [Your character ID]``` line
![image](https://user-images.githubusercontent.com/53513566/136862154-4a867b53-4c80-4fa8-88c3-fb702e68d6eb.png)
4. Use that in the Session Id input field in the GUI tool
5. Use the same IP as the server
6. Port is 1300 by default
7. Click the "Connect to API server" button and you should be able to directly add items to your character now





 
