package com.demo.aws.hello;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;


@RestController
public class DemoController {
    @GetMapping
    public String sayHello(){
        return "Hello";
    }
}
