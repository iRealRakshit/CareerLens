// static/tree.js

window.CareerLensTree = {
  // A new implementation focused on biological realism and structural correctness.
  
  render: function(completedTasks, totalTasks) {
    const treeContainer = document.getElementById('treeContainer');
    const svgWidth = treeContainer.clientWidth;
    const svgHeight = treeContainer.clientHeight;

    d3.select(treeContainer).select("svg").remove();

    const svg = d3.select(treeContainer).append("svg")
      .attr("width", svgWidth)
      .attr("height", svgHeight)
      .attr("viewBox", `0 0 ${svgWidth * 1.5} ${svgHeight * 1.2}`)
      .attr("transform", `translate(${-svgWidth * 0.25}, ${-svgHeight * 0.1})`);

    // Soil (realistic texture and color variation)
    // Soil with noise and texture
    for (let i = 0; i < 100; i++) {
        const x = Math.random() * svgWidth;
        const y = svgHeight - 50 + Math.random() * 50;
        const color = d3.interpolateLab("#4A4A4A", "#6B4226")(Math.random());
        svg.append("circle")
            .attr("cx", x)
            .attr("cy", y)
            .attr("r", Math.random() * 3)
            .attr("fill", color);
    }
    
    // Seed
    if (completedTasks === 0) {
        svg.append("circle")
            .attr("cx", svgWidth / 2)
            .attr("cy", svgHeight - 50)
            .attr("r", 5)
            .attr("fill", "#6B4226"); // Dark brown seed
        
        // Cracked shell
        svg.append("path")
            .attr("d", `M${svgWidth/2 - 3},${svgHeight-52} Q${svgWidth/2 - 1},${svgHeight-55} ${svgWidth/2},${svgHeight-52}`)
            .attr("stroke", "#4A2A0C")
            .attr("stroke-width", 0.5)
            .attr("fill", "none");
    } else {
        // Trunk (dominant, tapering, textured)
        const trunkHeight = Math.min(svgHeight * 0.7, 20 + completedTasks * 4);
        const trunkBaseWidth = Math.min(svgWidth * 0.15, 5 + completedTasks * 0.8);
        const trunkTopWidth = trunkBaseWidth * 0.6;

        const trunkGradient = svg.append("defs").append("linearGradient")
            .attr("id", "trunkGradient")
            .attr("x1", "0%").attr("y1", "0%").attr("x2", "100%").attr("y2", "0%");
        trunkGradient.append("stop").attr("offset", "0%").style("stop-color", "#6B4226");
        trunkGradient.append("stop").attr("offset", "50%").style("stop-color", "#8B4513");
        trunkGradient.append("stop").attr("offset", "100%").style("stop-color", "#6B4226");
        
        const trunk = svg.append("path")
            .attr("d", `M${svgWidth/2 - trunkBaseWidth/2},${svgHeight-50} 
                        L${svgWidth/2 - trunkTopWidth/2},${svgHeight-50-trunkHeight} 
                        L${svgWidth/2 + trunkTopWidth/2},${svgHeight-50-trunkHeight} 
                        L${svgWidth/2 + trunkBaseWidth/2},${svgHeight-50}Z`)
            .attr("fill", "url(#trunkGradient)"); // Brown

        // Bark texture
        for (let i = 0; i < trunkHeight / 10; i++) {
            const y = svgHeight - 50 - (i * 10) - Math.random() * 5;
            const xOffset = (Math.random() - 0.5) * trunkBaseWidth * 0.1;
            svg.append("line")
                .attr("x1", svgWidth / 2 - trunkBaseWidth / 2 + xOffset)
                .attr("y1", y)
                .attr("x2", svgWidth / 2 + trunkBaseWidth / 2 + xOffset)
                .attr("y2", y)
                .attr("stroke", "#6B4226")
                .attr("stroke-width", 0.5);
        }

        // Recursive function to draw branches
        function drawBranch(parentX, parentY, parentAngle, parentLength, parentThickness, currentDepth) {
            if (currentDepth > 3 || parentLength < 5) return; // Limit depth and size

            const numBranches = 2 + Math.floor(completedTasks / (8 * (currentDepth + 1))); // More branches with tasks
            for (let i = 0; i < numBranches; i++) {
                const angleOffset = (Math.random() - 0.5) * (Math.PI / (currentDepth + 2)); // Angle varies with depth
                let branchAngle = parentAngle + angleOffset;
                
                // Enforce branch angles
                if (currentDepth === 0) branchAngle = parentAngle + (i % 2 === 0 ? 1 : -1) * (Math.PI / 4 + Math.random() * Math.PI / 8); // Primary
                if (currentDepth === 1) branchAngle = parentAngle + (i % 2 === 0 ? 1 : -1) * (Math.PI / 6 + Math.random() * Math.PI / 12); // Secondary
                if (currentDepth === 2) branchAngle = parentAngle + (i % 2 === 0 ? 1 : -1) * (Math.PI / 8 + Math.random() * Math.PI / 16); // Tertiary

                const branchLength = parentLength * (0.6 + Math.random() * 0.2);
                const branchThickness = parentThickness * (0.6 + Math.random() * 0.2);

                const endX = parentX + Math.cos(branchAngle) * branchLength;
                const endY = parentY + Math.sin(branchAngle) * branchLength;

                svg.append("line")
                    .attr("x1", parentX)
                    .attr("y1", parentY)
                    .attr("x2", endX)
                    .attr("y2", endY)
                    .attr("stroke", "#8B4513")
                    .attr("stroke-width", branchThickness);

                // Add leaves (cloud-like structure)
                if (currentDepth >= 1) { // Leaves only on secondary and tertiary branches
                    const numClouds = Math.floor(completedTasks / 4) * (currentDepth + 1);
                    for (let j = 0; j < numClouds; j++) {
                        const cloudX = endX + (Math.random() - 0.5) * 20;
                        const cloudY = endY + (Math.random() - 0.5) * 20;
                        const cloudSize = 20 + Math.random() * 20;
                        
                        svg.append("ellipse")
                            .attr("cx", cloudX)
                            .attr("cy", cloudY)
                            .attr("rx", cloudSize)
                            .attr("ry", cloudSize * 0.6)
                            .attr("fill", d3.interpolateGreens(Math.random()))
                            .attr("opacity", 0.6);
                    }
                }

                // Add fruits
                if (completedTasks >= 28 && currentDepth >= 1) {
                    const numFruits = completedTasks / (12 * currentDepth) * (0.1 + Math.random() * 0.2);
                    for (let j = 0; j < numFruits; j++) {
                        const fruitX = endX + (Math.random() - 0.5) * 8;
                        const fruitY = endY + (Math.random() - 0.5) * 8;
                        svg.append("circle")
                            .attr("cx", fruitX)
                            .attr("cy", fruitY)
                            .attr("r", 3 + Math.random() * 2)
                            .attr("fill", "red");
                    }
                }

                drawBranch(endX, endY, branchAngle, branchLength, branchThickness, currentDepth + 1);
            }
        }

        // Start drawing branches from the top of the trunk
        drawBranch(svgWidth / 2, svgHeight - 50 - trunkHeight, -Math.PI / 2, trunkHeight * 0.7, trunkTopWidth, 0);
    }
  }
};